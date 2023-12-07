return {
  "gbprod/yanky.nvim",
  opts = {
    system_clipboard = {
      sync_with_ring = true,
    },
  },
  keys = {
    { "<leader>fp", function() require("telescope").extensions.yank_history.yank_history({}) end,  desc = "Open Yank History" },
    { "y",          "<Plug>(YankyYank)",                                                           mode = { "n", "x" },       desc = "Yank text" },
    { "p",          "<Plug>(YankyPutAfter)",                                                       mode = { "n", "x" },       desc = "Put yanked text after cursor" },
  }
}
