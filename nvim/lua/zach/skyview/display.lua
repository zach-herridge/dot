local M = {}

-- Show sky data in a new Neovim buffer
function M.show_in_buffer(screen)
  -- Create new buffer
  local buf = vim.api.nvim_create_buf(false, true)
  
  -- Convert screen array to lines
  local lines = {}
  for y = 1, #screen do
    lines[y] = table.concat(screen[y])
  end
  
  -- Set buffer content
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  
  -- Set buffer options
  vim.api.nvim_buf_set_option(buf, 'buftype', 'nofile')
  vim.api.nvim_buf_set_option(buf, 'bufhidden', 'wipe')
  vim.api.nvim_buf_set_option(buf, 'swapfile', false)
  vim.api.nvim_buf_set_name(buf, 'Sky View')
  
  -- Open in new window
  vim.cmd('split')
  vim.api.nvim_win_set_buf(0, buf)
  
  -- Set window options for better display
  vim.wo.wrap = false
  vim.wo.number = false
  vim.wo.relativenumber = false
  vim.wo.signcolumn = 'no'
  
  -- Add some basic keymaps
  local opts = { buffer = buf, silent = true }
  vim.keymap.set('n', 'q', '<cmd>close<cr>', opts)
  vim.keymap.set('n', '<Esc>', '<cmd>close<cr>', opts)
end

return M
