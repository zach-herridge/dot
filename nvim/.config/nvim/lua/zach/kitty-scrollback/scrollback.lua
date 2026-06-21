local M = {}

function M.open(data)
  local win = vim.api.nvim_get_current_win()
  vim.wo[win].wrap = false
  vim.wo[win].number = false
  vim.wo[win].relativenumber = false
  vim.wo[win].signcolumn = "no"
  vim.wo[win].list = false

  local lines

  if data.source == "tmux" then
    -- Tmux mode: read scrollback from file
    lines = M.read_from_file(data.scrollback_file)
  else
    -- Kitty mode: fetch scrollback via kitty remote control
    lines = M.fetch_from_kitty(data)
  end

  if not lines then
    return
  end

  -- Strip trailing empty lines
  while #lines > 0 and lines[#lines] == "" do
    table.remove(lines)
  end

  -- Strip OSC sequences (shell integration markers, title sets, etc.)
  -- and clean carriage returns. Preserve SGR color codes for baleia.
  for i, line in ipairs(lines) do
    line = line:gsub("\27%].-\27\\", "")  -- OSC with ST terminator
    line = line:gsub("\27%].-\7", "")     -- OSC with BEL terminator
    line = line:gsub("\r", "")
    lines[i] = line
  end

  local buf = vim.api.nvim_get_current_buf()
  vim.bo[buf].buftype = "nofile"
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].swapfile = false
  vim.bo[buf].modifiable = true

  -- Set lines then convert ANSI escape codes to nvim highlights via baleia.
  -- async = false ensures all chunks are processed before we lock the buffer.
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  require("baleia").setup({ async = false }).once(buf)

  vim.bo[buf].modifiable = false

  if data.source ~= "tmux" then
    M.position_cursor(data)
  else
    -- Tmux mode: scroll to bottom
    vim.cmd("normal! G")
  end

  M.setup_keymaps(buf)
end

--- Read scrollback content from a temp file (tmux mode)
---@param filepath string|nil
---@return string[]|nil
function M.read_from_file(filepath)
  if not filepath then
    vim.notify("kitty-scrollback: no scrollback file provided", vim.log.levels.ERROR)
    return nil
  end

  local f = io.open(filepath, "r")
  if not f then
    vim.notify("kitty-scrollback: cannot open scrollback file: " .. filepath, vim.log.levels.ERROR)
    return nil
  end

  local text = f:read("*a")
  f:close()
  -- Clean up the temp file
  os.remove(filepath)

  return vim.split(text, "\n")
end

--- Fetch scrollback via kitty remote control (kitty mode)
---@param data table
---@return string[]|nil
function M.fetch_from_kitty(data)
  local cmd = {
    data.kitty_path, "@", "get-text",
    "--match=id:" .. data.window_id,
    "--extent=all",
    "--ansi",
    "--clear-selection",
  }

  local result = vim.system(cmd, { text = true }):wait()

  if result.code ~= 0 then
    vim.notify(
      "kitty-scrollback: get-text failed: " .. (result.stderr or ""),
      vim.log.levels.ERROR
    )
    return nil
  end

  local text = result.stdout or ""
  return vim.split(text, "\n")
end

function M.position_cursor(data)
  local last_line = vim.fn.line("$")
  local scrolled_by = data.scrolled_by
  local y = data.cursor_y - 1 -- 0-indexed row from top of viewport
  local x = data.cursor_x - 1 -- 0-indexed column

  local orig_ve = vim.o.virtualedit
  local orig_so = vim.o.scrolloff
  vim.o.virtualedit = "all"
  vim.o.scrolloff = 0

  -- Anchor: put the last line at the bottom of the window
  ---@diagnostic disable-next-line: param-type-mismatch
  vim.fn.cursor(last_line, 1)
  vim.cmd("normal! zb")

  -- If terminal was scrolled up from the bottom, scroll the view up to match
  if scrolled_by > 0 then
    vim.cmd.normal({
      vim.api.nvim_replace_termcodes(scrolled_by .. "<C-y>", true, false, true),
      bang = true,
    })
  end

  -- Place cursor relative to the top of the now-visible viewport
  local top_line = vim.fn.line("w0")
  local target_line = math.min(top_line + y, last_line)
  vim.fn.cursor(target_line, 1)
  if x > 0 then
    vim.cmd.normal({ x .. "l", bang = true })
  end

  vim.o.virtualedit = orig_ve
  vim.o.scrolloff = orig_so
end

function M.setup_keymaps(buf)
  local opts = { buffer = buf, silent = true, nowait = true }
  vim.keymap.set("n", "q", function()
    vim.cmd("qa!")
  end, opts)
  vim.keymap.set("n", "<Esc>", function()
    vim.cmd("qa!")
  end, opts)
end

return M
