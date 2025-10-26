return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  opts = {
    bigfile = { enabled = true }, -- Disable features for large files
    notifier = { enabled = true }, -- Better notifications
    quickfile = { enabled = true }, -- Fast file opening
    statuscolumn = { enabled = true }, -- Better status column
    words = { enabled = false }, -- Highlight word under cursor
    explorer = { enabled = true },
  },
  keys = {
    { "<leader>fD", function() Snacks.explorer() end, desc = "File browser" },
    { "<leader>sn", function() Snacks.notifier.show_history() end, desc = "Notification History" },
    { "<leader>gg", function() Snacks.lazygit() end, desc = "Lazygit" },
  },
}
