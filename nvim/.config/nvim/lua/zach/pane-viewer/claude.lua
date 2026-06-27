-- claude.lua — Render a Claude Code conversation transcript (JSONL) into a
-- readable, navigable buffer with highlighted message headers, tool calls, and
-- truncated tool output.

local M = {}

local ui = require("zach.pane-viewer.ui")

local ns = vim.api.nvim_create_namespace("pane-viewer-claude")

-- Tool output longer than this many lines is truncated with a "... N more" note.
local MAX_OUTPUT_LINES = 30
-- Single-line detail (e.g. a Bash command) longer than this is ellipsized.
local MAX_DETAIL_LEN = 90

-- ── Timestamp formatting ────────────────────────────────────────────────────

--- Convert a UTC ISO-8601 timestamp to a local "h:MM AM/PM" string.
---@param ts string|nil
---@return string
local function format_time(ts)
  if not ts then
    return ""
  end
  local year, month, day, hour, min, sec =
    ts:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)")
  if not hour then
    return ""
  end

  local utc = os.time({
    year = tonumber(year),
    month = tonumber(month),
    day = tonumber(day),
    hour = tonumber(hour),
    min = tonumber(min),
    sec = tonumber(sec),
    isdst = false,
  })

  -- Offset between local time and UTC, to shift the parsed UTC stamp.
  local now = os.time()
  local offset = now - os.time(os.date("!*t", now))
  return (os.date("%I:%M %p", utc + offset):gsub("^0", ""))
end

-- ── Tool-call header formatting ─────────────────────────────────────────────

--- Pull the most relevant single-line detail out of a tool's input table.
---@param name string
---@param input table
---@return string
local function tool_detail(name, input)
  input = input or {}
  local detail
  if name == "Read" or name == "Edit" or name == "Write" then
    detail = input.file_path
  elseif name == "Bash" then
    detail = input.command
  elseif name == "Grep" then
    detail = input.pattern
    if detail and input.path and input.path ~= "" then
      detail = detail .. " in " .. input.path
    end
  elseif name == "Glob" then
    detail = input.pattern
  elseif name == "Agent" then
    detail = input.description
  elseif name == "WebSearch" or name == "WebFetch" then
    detail = input.query or input.url
  else
    detail = input.file_path or input.path or input.command or input.query
  end

  if type(detail) ~= "string" then
    return ""
  end
  detail = detail:gsub("[\r\n]+", " ")
  if #detail > MAX_DETAIL_LEN then
    detail = detail:sub(1, MAX_DETAIL_LEN - 3) .. "..."
  end
  return detail
end

-- ── JSONL parsing ───────────────────────────────────────────────────────────

--- Extract concatenated text blocks from a message content field.
---@param content any
---@return string|nil
local function extract_text(content)
  if type(content) == "string" then
    return content ~= "" and content or nil
  end
  if type(content) ~= "table" then
    return nil
  end
  local parts = {}
  for _, c in ipairs(content) do
    if type(c) == "table" and c.type == "text" and c.text and c.text ~= "" then
      table.insert(parts, c.text)
    end
  end
  return #parts > 0 and table.concat(parts, "\n") or nil
end

--- Parse a conversation JSONL file into structured turns.
--- A "turn" is one user message plus the assistant parts (text + tool calls,
--- with their results attached) that answer it.
---@param filepath string
---@return table[] turns
local function parse_conversation(filepath)
  if not filepath or vim.fn.filereadable(filepath) == 0 then
    return {}
  end
  local ok, raw_lines = pcall(vim.fn.readfile, filepath)
  if not ok then
    return {}
  end

  local turns = {}
  local current = nil
  local pending_tools = {} -- tool_use id -> index in current.assistant_parts

  local function start_turn(text, timestamp)
    pending_tools = {}
    current = {
      user_text = text,
      user_timestamp = timestamp,
      assistant_parts = {},
      assistant_timestamp = nil,
    }
    table.insert(turns, current)
  end

  for _, line in ipairs(raw_lines) do
    if line ~= "" then
      local decoded, entry = pcall(vim.fn.json_decode, line)
      if decoded and type(entry) == "table" and entry.message then
        local content = entry.message.content

        if entry.type == "user" then
          if type(content) == "string" and content ~= "" then
            start_turn(content, entry.timestamp)
          elseif type(content) == "table" then
            -- May carry tool_results (attach to current turn) and/or new text.
            local has_text = false
            for _, c in ipairs(content) do
              if type(c) == "table" then
                if c.type == "tool_result" and c.tool_use_id and current then
                  local idx = pending_tools[c.tool_use_id]
                  if idx then
                    current.assistant_parts[idx].result = extract_text(c.content)
                  end
                elseif c.type == "text" and c.text and c.text ~= "" then
                  has_text = true
                end
              end
            end
            if has_text then
              start_turn(extract_text(content), entry.timestamp)
            end
          end
        elseif entry.type == "assistant" and current and type(content) == "table" then
          if not current.assistant_timestamp then
            current.assistant_timestamp = entry.timestamp
          end
          for _, c in ipairs(content) do
            if type(c) == "table" then
              if c.type == "text" and c.text and c.text ~= "" then
                table.insert(current.assistant_parts, { kind = "text", text = c.text })
              elseif c.type == "tool_use" then
                table.insert(current.assistant_parts, {
                  kind = "tool",
                  name = c.name or "Unknown",
                  input = c.input or {},
                  result = nil,
                })
                if c.id then
                  pending_tools[c.id] = #current.assistant_parts
                end
              end
              -- thinking blocks are intentionally skipped
            end
          end
        end
      end
    end
  end

  return turns
end

-- ── Rendering ───────────────────────────────────────────────────────────────

--- Accumulates lines + extmark highlights + navigation markers for a buffer.
---@class Renderer
local Renderer = {}
Renderer.__index = Renderer

function Renderer.new(width)
  return setmetatable({
    lines = {},
    highlights = {}, -- { row0, group, col0, col_end }
    headers = {}, -- 1-indexed line numbers of message headers
    tools = {}, -- 1-indexed line numbers of tool calls
    sep = string.rep("~", math.min(width, 60)),
  }, Renderer)
end

--- Append one line (newlines collapsed) and return its 1-indexed line number.
---@param text string
---@return integer line_nr
function Renderer:add(text)
  table.insert(self.lines, (text:gsub("[\r\n]+", " ")))
  return #self.lines
end

--- Highlight a span on the most recently added line.
---@param group string
---@param col0 integer
---@param col_end integer
function Renderer:hl_last(group, col0, col_end)
  table.insert(self.highlights, { #self.lines - 1, group, col0, col_end })
end

--- Render a "You"/"Claude" header with a timestamp.
---@param label string
---@param group string
---@param timestamp string|nil
function Renderer:header(label, group, timestamp)
  local time = format_time(timestamp)
  local text = time ~= "" and (label .. "  " .. time) or label
  local nr = self:add(text)
  table.insert(self.headers, nr)
  self:hl_last(group, 0, #label)
  if time ~= "" then
    self:hl_last("PaneViewerTimestamp", #label + 2, #text)
  end
  self:hl_last_sep()
end

--- Add the "~~~~" separator line under a header plus a blank spacer.
function Renderer:hl_last_sep()
  self:add(self.sep)
  self:hl_last("PaneViewerSeparator", 0, #self.sep)
  self:add("")
end

--- Render assistant text, lightly highlighting ``` code fences.
---@param text string
function Renderer:assistant_text(text)
  local in_code = false
  for _, tl in ipairs(vim.split(text, "\n")) do
    self:add(tl)
    local trimmed = tl:match("^%s*(.-)%s*$")
    if trimmed:match("^```") then
      if in_code then
        self:hl_last("PaneViewerCodeFence", 0, #tl)
        in_code = false
      else
        self:hl_last("PaneViewerCodeFence", 0, 3)
        local lang = trimmed:sub(4)
        if lang ~= "" then
          self:hl_last("PaneViewerCodeLang", 3, 3 + #lang)
        end
        in_code = true
      end
    end
  end
end

--- Render a tool call header plus its (truncated) output.
---@param part table  { name, input, result }
function Renderer:tool(part)
  local detail = tool_detail(part.name, part.input)
  local prefix = "  > "
  local header = detail ~= "" and (part.name .. "  " .. detail) or part.name
  local nr = self:add(prefix .. header)
  table.insert(self.tools, nr)

  local plen = #prefix
  self:hl_last("PaneViewerToolDetail", 0, plen)
  self:hl_last("PaneViewerToolCall", plen, plen + #part.name)
  if detail ~= "" then
    self:hl_last("PaneViewerToolDetail", plen + #part.name, plen + #header)
  end

  if part.result and part.result ~= "" then
    self:tool_output(part.result)
  end
end

--- Render a boxed, truncated block of tool output.
---@param result string
function Renderer:tool_output(result)
  local out_lines = vim.split(result, "\n")
  local total = #out_lines
  local show = math.min(total, MAX_OUTPUT_LINES)
  local border = "    " .. string.rep("-", math.min(#self.sep - 4, 50))

  self:add(border)
  self:hl_last("PaneViewerOutputBorder", 0, #border)

  for i = 1, show do
    self:add("    " .. out_lines[i])
    self:hl_last("PaneViewerOutput", 0, #self.lines[#self.lines])
  end

  if total > MAX_OUTPUT_LINES then
    local msg = ("    ... (%d more lines)"):format(total - MAX_OUTPUT_LINES)
    self:add(msg)
    self:hl_last("PaneViewerOutputBorder", 0, #msg)
  end

  self:add(border)
  self:hl_last("PaneViewerOutputBorder", 0, #border)
end

--- Render all turns into this renderer's buffers.
---@param turns table[]
function Renderer:render(turns)
  for _, turn in ipairs(turns) do
    self:header("You", "PaneViewerUserHeader", turn.user_timestamp)
    for _, tl in ipairs(vim.split(turn.user_text or "", "\n")) do
      self:add(tl)
    end
    self:add("")

    if #turn.assistant_parts > 0 then
      self:header("Claude", "PaneViewerAssistantHeader", turn.assistant_timestamp)
      for _, part in ipairs(turn.assistant_parts) do
        if part.kind == "text" then
          self:assistant_text(part.text)
        elseif part.kind == "tool" then
          self:tool(part)
        end
      end
    end

    self:add("")
    self:add("")
  end
end

-- ── Public entry point ──────────────────────────────────────────────────────

--- @param data { conversation_file: string, session_cwd?: string, ambiguous?: boolean }
function M.open(data)
  ui.style_window({ wrap = true })

  local turns = parse_conversation(data.conversation_file)
  if #turns == 0 then
    ui.show_message("Claude conversation is empty or could not be parsed.")
    return
  end

  local r = Renderer.new(vim.o.columns)
  r:render(turns)

  local buf = ui.scratch_buffer()
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, r.lines)

  for _, h in ipairs(r.highlights) do
    local row, group, col0, col_end = h[1], h[2], h[3], h[4]
    local line = r.lines[row + 1] or ""
    pcall(vim.api.nvim_buf_set_extmark, buf, ns, row, col0, {
      end_col = math.min(col_end, #line),
      hl_group = group,
    })
  end

  ui.lock(buf)

  -- markdown treesitter parser (ships with neovim) for code-block injection.
  pcall(vim.treesitter.start, buf, "markdown")
  vim.wo[vim.api.nvim_get_current_win()].conceallevel = 0

  -- Stash navigation markers for the jump keymaps.
  vim.b[buf].pv_headers = r.headers
  vim.b[buf].pv_tools = r.tools

  vim.cmd("normal! G") -- start at the latest message

  M.setup_keymaps(buf)

  -- Pin a context line so it's always clear WHICH conversation this is — handy
  -- with many concurrent sessions. If detection was ambiguous (more than one
  -- Claude session under this pane), flag it so a wrong guess is visible rather
  -- than silent.
  local cwd = data.session_cwd ~= "" and vim.fn.fnamemodify(data.session_cwd, ":~")
    or "(unknown cwd)"
  local segments = {
    { text = " Claude ", group = "PaneViewerAssistantHeader" },
    { text = " " .. cwd .. " ", group = "PaneViewerTimestamp" },
  }
  if data.ambiguous then
    table.insert(segments, { text = " ⚠ multiple sessions — showing innermost ", group = "PaneViewerCodeLang" })
  end
  ui.set_winbar(segments)
end

-- ── Navigation keymaps ──────────────────────────────────────────────────────

--- Jump to the next/previous marker in a sorted (ascending) list of line
--- numbers, optionally filtered by `predicate`.
---@param buf integer
---@param key string         buffer-local var holding the markers
---@param forward boolean
---@param predicate? fun(line_nr: integer): boolean
local function jump(buf, key, forward, predicate)
  local marks = vim.b[buf][key] or {}
  local cur = vim.api.nvim_win_get_cursor(0)[1]
  local start, stop, step
  if forward then
    start, stop, step = 1, #marks, 1
  else
    start, stop, step = #marks, 1, -1
  end
  for i = start, stop, step do
    local nr = marks[i]
    local past = forward and nr > cur or (not forward and nr < cur)
    if past and (not predicate or predicate(nr)) then
      vim.api.nvim_win_set_cursor(0, { nr, 0 })
      return
    end
  end
end

function M.setup_keymaps(buf)
  ui.setup_quit_keys(buf)

  local function map(lhs, fn, desc)
    vim.keymap.set("n", lhs, fn, { buffer = buf, silent = true, nowait = true, desc = desc })
  end

  local function is_user(nr)
    return (vim.api.nvim_buf_get_lines(buf, nr - 1, nr, false)[1] or ""):match("^You")
      ~= nil
  end

  map("]]", function() jump(buf, "pv_headers", true) end, "Next message")
  map("[[", function() jump(buf, "pv_headers", false) end, "Prev message")
  map("]t", function() jump(buf, "pv_tools", true) end, "Next tool call")
  map("[t", function() jump(buf, "pv_tools", false) end, "Prev tool call")
  map("]u", function() jump(buf, "pv_headers", true, is_user) end, "Next user message")
  map("[u", function() jump(buf, "pv_headers", false, is_user) end, "Prev user message")
end

return M
