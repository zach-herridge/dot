local M = {}

function M.show_in_buffer(screen)
  local buf = vim.api.nvim_create_buf(false, true)

  local lines = {}
  for y = 1, #screen do
    lines[y] = table.concat(screen[y])
  end

  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)

  vim.api.nvim_buf_set_option(buf, 'buftype', 'nofile')
  vim.api.nvim_buf_set_option(buf, 'bufhidden', 'wipe')
  vim.api.nvim_buf_set_option(buf, 'swapfile', false)
  vim.api.nvim_buf_set_name(buf, 'Sky View')

  vim.cmd('split')
  vim.api.nvim_win_set_buf(0, buf)

  vim.wo.wrap = false
  vim.wo.number = false
  vim.wo.relativenumber = false
  vim.wo.signcolumn = 'no'

  local opts = { buffer = buf, silent = true }
  vim.keymap.set('n', 'q', '<cmd>close<cr>', opts)
  vim.keymap.set('n', '<Esc>', '<cmd>close<cr>', opts)
end

return M
