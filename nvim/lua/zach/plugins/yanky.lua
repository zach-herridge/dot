return {
  "gbprod/yanky.nvim",
  opts = {
  },
  keys = {
    { "<leader>fp", function() require("telescope").extensions.yank_history.yank_history({ }) end, desc = "Find yank history" },
    { "y", "<plug>(yankyyank)", mode = { "n", "x" }, desc = "yank text" },
    { "p", "<plug>(yankyputafter)", mode = { "n", "x" }, desc = "put yanked text after cursor" },
  }
}
