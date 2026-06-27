-- scrollback.lua — Render a tmux pane's captured scrollback into the buffer,
-- converting ANSI/SGR color escapes into nvim highlights via baleia.

local M = {}

local ui = require("zach.pane-viewer.ui")

--- Strip OSC sequences (shell-integration markers, title sets, etc.) and carriage
--- returns from a captured line, while preserving SGR color codes for baleia.
---@param line string
---@return string
local function clean_line(line)
  line = line:gsub("\27%].-\27\\", "") -- OSC terminated by ST
  line = line:gsub("\27%].-\7", "") -- OSC terminated by BEL
  line = line:gsub("\r", "")
  return line
end

--- @param data { lines: string[] }
function M.open(data)
  ui.style_window({ wrap = false })

  local lines = data.lines or {}

  -- Drop trailing blank lines so the view ends at the last real output.
  while #lines > 0 and lines[#lines] == "" do
    table.remove(lines)
  end

  if #lines == 0 then
    lines = { "(pane scrollback is empty)" }
  end

  for i, line in ipairs(lines) do
    lines[i] = clean_line(line)
  end

  local buf = ui.scratch_buffer()
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)

  -- Convert ANSI escapes to highlights. async=false guarantees all chunks are
  -- processed before we lock the buffer read-only.
  require("baleia").setup({ async = false }).once(buf)

  ui.lock(buf)
  vim.cmd("normal! G") -- start at the bottom (most recent output)

  ui.setup_quit_keys(buf)
end

return M
