local M = {}

function M.open(data)
  local win = vim.api.nvim_get_current_win()
  vim.wo[win].wrap = false
  vim.wo[win].number = false
  vim.wo[win].relativenumber = false
  vim.wo[win].signcolumn = "no"
  vim.wo[win].list = false

  -- Fetch scrollback with ANSI codes (synchronous - get-text is instant)
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
    return
  end

  local text = result.stdout or ""
  local lines = vim.split(text, "\n")

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

  -- Set lines then convert ANSI escape codes to nvim highlights via baleia
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  require("baleia").setup({}).once(buf)

  vim.bo[buf].modifiable = false

  M.position_cursor(data)
  M.setup_keymaps(buf)
end

function M.position_cursor(data)
  local last_line = vim.fn.line("$")
  local lines = data.lines
  local y = data.cursor_y - 1
  local x = data.cursor_x - 1
  local scrolled_by = data.scrolled_by

  local orig_ve = vim.o.virtualedit
  local orig_so = vim.o.scrolloff
  vim.o.virtualedit = "all"
  vim.o.scrolloff = 0

  ---@diagnostic disable-next-line: param-type-mismatch
  vim.fn.cursor(last_line, 1)

  if lines > 0 then
    vim.cmd.normal({ lines .. "k", bang = true })
  end
  if y > 0 then
    vim.cmd.normal({ y .. "j", bang = true })
  end
  if x > 0 then
    vim.cmd.normal({ x .. "l", bang = true })
  end
  if scrolled_by > 0 then
    vim.cmd.normal({
      vim.api.nvim_replace_termcodes(scrolled_by .. "<C-y>", true, false, true),
      bang = true,
    })
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
