local M = {}

local ns = vim.api.nvim_create_namespace("ksb-claude")

local MAX_OUTPUT_LINES = 30

--- Convert UTC ISO-8601 timestamp to local time string
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

  local now = os.time()
  local utc_now = os.time(os.date("!*t", now))
  local offset = now - utc_now
  local local_time = utc + offset

  return os.date("%I:%M %p", local_time):gsub("^0", "")
end

--- Build a one-line tool call header
---@param name string
---@param input table
---@return string header The tool name + detail
---@return string name_part Just the tool name for highlighting
local function format_tool_header(name, input)
  input = input or {}
  local detail = ""

  if name == "Read" then
    detail = input.file_path or ""
  elseif name == "Edit" then
    detail = input.file_path or ""
  elseif name == "Write" then
    detail = input.file_path or ""
  elseif name == "Bash" then
    local cmd = input.command or ""
    cmd = cmd:gsub("\r", ""):gsub("\n", " ")
    if #cmd > 80 then
      cmd = cmd:sub(1, 77) .. "..."
    end
    detail = cmd
  elseif name == "Grep" then
    local pat = input.pattern or ""
    local path = input.path or ""
    detail = pat
    if path ~= "" then
      detail = detail .. " in " .. path
    end
  elseif name == "Glob" then
    detail = input.pattern or ""
  elseif name == "Agent" then
    detail = input.description or ""
  elseif name == "WebSearch" or name == "WebFetch" then
    detail = input.query or input.url or ""
  else
    local val = input.file_path or input.path or input.command or input.query or ""
    if type(val) ~= "string" then
      val = ""
    end
    detail = val
  end

  detail = detail:gsub("\r", ""):gsub("\n", " ")
  if #detail > 90 then
    detail = detail:sub(1, 87) .. "..."
  end

  return name .. "  " .. detail, name
end

--- Extract text from tool_result content (can be string or list of text blocks)
---@param content any
---@return string|nil
local function extract_tool_result(content)
  if type(content) == "string" then
    return content ~= "" and content or nil
  end
  if type(content) == "table" then
    local parts = {}
    for _, c in ipairs(content) do
      if type(c) == "table" and c.type == "text" and c.text then
        table.insert(parts, c.text)
      end
    end
    return #parts > 0 and table.concat(parts, "\n") or nil
  end
  return nil
end

--- Extract user text from a message content field
---@param content any
---@return string|nil
local function extract_user_text(content)
  if type(content) == "string" then
    return content ~= "" and content or nil
  end

  if type(content) ~= "table" then
    return nil
  end

  local texts = {}
  for _, c in ipairs(content) do
    if type(c) == "table" and c.type == "text" and c.text and c.text ~= "" then
      table.insert(texts, c.text)
    end
  end

  return #texts > 0 and table.concat(texts, "\n") or nil
end

--- Parse JSONL conversation into structured turns with tool results
---@param filepath string
---@return table[]
local function parse_conversation(filepath)
  local raw_lines = vim.fn.readfile(filepath)
  local turns = {}
  local current_turn = nil
  -- Map tool_use id -> index in current_turn.assistant_parts
  local pending_tools = {}

  for _, line in ipairs(raw_lines) do
    if line == "" then
      goto continue
    end

    local ok, entry = pcall(vim.fn.json_decode, line)
    if not ok or type(entry) ~= "table" then
      goto continue
    end

    if entry.type == "user" and entry.message then
      local content = entry.message.content

      -- Check for tool results first (these are automated responses)
      if type(content) == "table" then
        local has_text = false
        for _, c in ipairs(content) do
          if type(c) == "table" then
            if c.type == "tool_result" and c.tool_use_id and current_turn then
              -- Attach result to the matching tool call
              local idx = pending_tools[c.tool_use_id]
              if idx then
                local result = extract_tool_result(c.content)
                if result then
                  current_turn.assistant_parts[idx].result = result
                end
              end
            elseif c.type == "text" and c.text and c.text ~= "" then
              has_text = true
            end
          end
        end

        if has_text then
          -- New user turn (has actual text, not just tool results)
          pending_tools = {}
          local text = extract_user_text(content)
          if text then
            current_turn = {
              user_text = text,
              user_timestamp = entry.timestamp,
              assistant_parts = {},
              assistant_timestamp = nil,
            }
            table.insert(turns, current_turn)
          end
        end
      elseif type(content) == "string" and content ~= "" then
        -- Plain string user message -> new turn
        pending_tools = {}
        current_turn = {
          user_text = content,
          user_timestamp = entry.timestamp,
          assistant_parts = {},
          assistant_timestamp = nil,
        }
        table.insert(turns, current_turn)
      end
    elseif entry.type == "assistant" and entry.message and current_turn then
      local content = entry.message.content
      if type(content) ~= "table" then
        goto continue
      end

      if not current_turn.assistant_timestamp then
        current_turn.assistant_timestamp = entry.timestamp
      end

      for _, c in ipairs(content) do
        if type(c) ~= "table" then
          goto inner_continue
        end

        if c.type == "text" and c.text and c.text ~= "" then
          table.insert(current_turn.assistant_parts, {
            kind = "text",
            text = c.text,
          })
        elseif c.type == "tool_use" then
          table.insert(current_turn.assistant_parts, {
            kind = "tool",
            name = c.name or "Unknown",
            input = c.input or {},
            result = nil, -- filled in by subsequent tool_result
          })
          if c.id then
            pending_tools[c.id] = #current_turn.assistant_parts
          end
        end
        -- Skip thinking blocks

        ::inner_continue::
      end
    end

    ::continue::
  end

  return turns
end

--- Add lines to the buffer, tracking line count
---@param lines string[] accumulator
---@param new_lines string[] lines to add
local function add_lines(lines, new_lines)
  for _, l in ipairs(new_lines) do
    table.insert(lines, l)
  end
end

--- Render a single line, sanitizing newlines
---@param lines string[]
---@param text string
local function add_line(lines, text)
  local clean = text:gsub("\r", ""):gsub("\n", " ")
  table.insert(lines, clean)
end

--- Render turns into buffer lines, highlights, and navigation markers
---@param turns table[]
---@param width number
---@return string[] lines
---@return table[] highlights
---@return integer[] headers (1-indexed line numbers)
---@return integer[] tool_lines (1-indexed line numbers of tool calls)
local function render_turns(turns, width)
  local lines = {}
  local highlights = {}
  local headers = {}
  local tool_lines = {}
  local sep_width = math.min(width, 60)
  local separator = string.rep("~", sep_width)

  for _, turn in ipairs(turns) do
    local user_time = format_time(turn.user_timestamp)

    -- User header
    local user_header = "You"
    if user_time ~= "" then
      user_header = user_header .. "  " .. user_time
    end
    add_line(lines, user_header)
    table.insert(headers, #lines)
    table.insert(highlights, { #lines - 1, "KsbUserHeader", 0, 3 })
    if user_time ~= "" then
      table.insert(highlights, { #lines - 1, "KsbTimestamp", 5, #user_header })
    end

    add_line(lines, separator)
    table.insert(highlights, { #lines - 1, "KsbSeparator", 0, #separator })
    add_line(lines, "")

    -- User text
    for _, text_line in ipairs(vim.split(turn.user_text, "\n")) do
      add_line(lines, text_line)
    end

    add_line(lines, "")

    -- Assistant section
    if #turn.assistant_parts > 0 then
      local asst_time = format_time(turn.assistant_timestamp)
      local asst_header = "Claude"
      if asst_time ~= "" then
        asst_header = asst_header .. "  " .. asst_time
      end
      add_line(lines, asst_header)
      table.insert(headers, #lines)
      table.insert(highlights, { #lines - 1, "KsbAssistantHeader", 0, 6 })
      if asst_time ~= "" then
        table.insert(highlights, { #lines - 1, "KsbTimestamp", 8, #asst_header })
      end

      add_line(lines, separator)
      table.insert(highlights, { #lines - 1, "KsbSeparator", 0, #separator })
      add_line(lines, "")

      -- Content
      for _, part in ipairs(turn.assistant_parts) do
        if part.kind == "text" then
          -- Render text with code fence highlighting
          local text_lines = vim.split(part.text, "\n")
          local in_code_block = false

          for _, tl in ipairs(text_lines) do
            add_line(lines, tl)
            local trimmed = tl:match("^%s*(.-)%s*$")

            if trimmed:match("^```") then
              if in_code_block then
                -- Closing fence
                table.insert(
                  highlights,
                  { #lines - 1, "KsbCodeFence", 0, #tl }
                )
                in_code_block = false
              else
                -- Opening fence - highlight the ``` and language
                table.insert(
                  highlights,
                  { #lines - 1, "KsbCodeFence", 0, 3 }
                )
                local lang = trimmed:sub(4)
                if lang ~= "" then
                  table.insert(
                    highlights,
                    { #lines - 1, "KsbCodeLang", 3, 3 + #lang }
                  )
                end
                in_code_block = true
              end
            end
          end
        elseif part.kind == "tool" then
          -- Tool call header
          local header, name_part = format_tool_header(part.name, part.input)
          local tool_prefix = "  > "
          add_line(lines, tool_prefix .. header)
          table.insert(tool_lines, #lines)

          -- Highlight: prefix dim, tool name bold, rest dim
          local line_idx = #lines - 1
          local prefix_len = #tool_prefix
          local name_len = #name_part
          table.insert(
            highlights,
            { line_idx, "KsbToolDetail", 0, prefix_len }
          )
          table.insert(
            highlights,
            { line_idx, "KsbToolCall", prefix_len, prefix_len + name_len }
          )
          if #header > name_len + 2 then
            table.insert(highlights, {
              line_idx,
              "KsbToolDetail",
              prefix_len + name_len,
              prefix_len + #header,
            })
          end

          -- Tool result output
          if part.result then
            local result_lines = vim.split(part.result, "\n")
            local total = #result_lines
            local show = math.min(total, MAX_OUTPUT_LINES)
            local truncated = total > MAX_OUTPUT_LINES

            -- Output border top
            add_line(lines, "    " .. string.rep("-", math.min(sep_width - 4, 50)))
            table.insert(
              highlights,
              { #lines - 1, "KsbOutputBorder", 0, #lines[#lines] }
            )

            for i = 1, show do
              add_line(lines, "    " .. result_lines[i])
              table.insert(
                highlights,
                { #lines - 1, "KsbOutput", 0, #lines[#lines] }
              )
            end

            if truncated then
              local msg = string.format(
                "    ... (%d more lines)",
                total - MAX_OUTPUT_LINES
              )
              add_line(lines, msg)
              table.insert(
                highlights,
                { #lines - 1, "KsbOutputBorder", 0, #msg }
              )
            end

            -- Output border bottom
            add_line(lines, "    " .. string.rep("-", math.min(sep_width - 4, 50)))
            table.insert(
              highlights,
              { #lines - 1, "KsbOutputBorder", 0, #lines[#lines] }
            )
          end
        end
      end
    end

    -- Turn spacing
    add_line(lines, "")
    add_line(lines, "")
  end

  return lines, highlights, headers, tool_lines
end

function M.open(data)
  local win = vim.api.nvim_get_current_win()
  vim.wo[win].wrap = true
  vim.wo[win].linebreak = true
  vim.wo[win].number = false
  vim.wo[win].relativenumber = false
  vim.wo[win].signcolumn = "no"

  -- Parse conversation
  local turns = parse_conversation(data.conversation_file)

  if #turns == 0 then
    vim.notify("kitty-scrollback: no conversation turns found", vim.log.levels.WARN)
    return
  end

  -- Set up buffer
  local buf = vim.api.nvim_get_current_buf()
  vim.bo[buf].buftype = "nofile"
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].swapfile = false
  vim.bo[buf].modifiable = true

  -- Render
  local width = vim.o.columns
  local render_lines, highlights, headers, tool_positions =
    render_turns(turns, width)

  vim.api.nvim_buf_set_lines(buf, 0, -1, false, render_lines)

  -- Apply highlights
  for _, hl in ipairs(highlights) do
    pcall(vim.api.nvim_buf_set_extmark, buf, ns, hl[1], hl[3], {
      end_col = math.min(hl[4], #render_lines[hl[1] + 1] or 0),
      hl_group = hl[2],
    })
  end

  vim.bo[buf].modifiable = false

  -- Treesitter markdown parser for code block syntax highlighting
  -- (language injection handles ```lua, ```python, etc.)
  vim.treesitter.start(buf, "markdown")
  vim.wo[win].conceallevel = 0

  -- Store positions for navigation
  vim.b[buf].ksb_headers = headers
  vim.b[buf].ksb_tools = tool_positions

  -- Scroll to bottom
  vim.cmd("normal! G")

  -- Keymaps
  M.setup_keymaps(buf)
end

function M.setup_keymaps(buf)
  local opts = { buffer = buf, silent = true, nowait = true }

  -- Quit
  vim.keymap.set("n", "q", function()
    vim.cmd("qa!")
  end, opts)
  vim.keymap.set("n", "<Esc>", function()
    vim.cmd("qa!")
  end, opts)

  -- Jump to next/prev message header
  vim.keymap.set("n", "]]", function()
    local hdrs = vim.b[buf].ksb_headers or {}
    local line = vim.api.nvim_win_get_cursor(0)[1]
    for _, h in ipairs(hdrs) do
      if h > line then
        vim.api.nvim_win_set_cursor(0, { h, 0 })
        return
      end
    end
  end, opts)

  vim.keymap.set("n", "[[", function()
    local hdrs = vim.b[buf].ksb_headers or {}
    local line = vim.api.nvim_win_get_cursor(0)[1]
    for i = #hdrs, 1, -1 do
      if hdrs[i] < line then
        vim.api.nvim_win_set_cursor(0, { hdrs[i], 0 })
        return
      end
    end
  end, opts)

  -- Jump to next/prev tool call
  vim.keymap.set("n", "]t", function()
    local tools = vim.b[buf].ksb_tools or {}
    local line = vim.api.nvim_win_get_cursor(0)[1]
    for _, t in ipairs(tools) do
      if t > line then
        vim.api.nvim_win_set_cursor(0, { t, 0 })
        return
      end
    end
  end, opts)

  vim.keymap.set("n", "[t", function()
    local tools = vim.b[buf].ksb_tools or {}
    local line = vim.api.nvim_win_get_cursor(0)[1]
    for i = #tools, 1, -1 do
      if tools[i] < line then
        vim.api.nvim_win_set_cursor(0, { tools[i], 0 })
        return
      end
    end
  end, opts)

  -- Jump to next/prev user message
  vim.keymap.set("n", "]u", function()
    local hdrs = vim.b[buf].ksb_headers or {}
    local line = vim.api.nvim_win_get_cursor(0)[1]
    for _, h in ipairs(hdrs) do
      if h > line then
        local text = vim.api.nvim_buf_get_lines(buf, h - 1, h, false)[1] or ""
        if text:match("^You") then
          vim.api.nvim_win_set_cursor(0, { h, 0 })
          return
        end
      end
    end
  end, opts)

  vim.keymap.set("n", "[u", function()
    local hdrs = vim.b[buf].ksb_headers or {}
    local line = vim.api.nvim_win_get_cursor(0)[1]
    for i = #hdrs, 1, -1 do
      if hdrs[i] < line then
        local text =
          vim.api.nvim_buf_get_lines(buf, hdrs[i] - 1, hdrs[i], false)[1]
            or ""
        if text:match("^You") then
          vim.api.nvim_win_set_cursor(0, { hdrs[i], 0 })
          return
        end
      end
    end
  end, opts)
end

return M
