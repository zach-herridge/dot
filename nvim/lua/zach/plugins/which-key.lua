return {
  "folke/which-key.nvim",
  event = "VeryLazy",
  opts = {
    plugins = { 
      spelling = true,
      presets = {
        operators = true,
        motions = true,
        text_objects = true,
        windows = true,
        nav = true,
        z = true,
        g = true,
      },
    },
    win = {
      border = "rounded",
      padding = { 1, 2 },
    },
    layout = {
      spacing = 3,
    },
    spec = {
      { "<leader>f", group = "find" },
      { "<leader>g", group = "git" },
      { "<leader>h", group = "hunks" },
      { "<leader>s", group = "search/swap" },
      { "<leader>c", group = "code" },
      { "<leader>cf", group = "format" },
      { "<leader>o", group = "open" },
      { "<leader>t", group = "toggle/terminal" },
      { "<leader>tc", group = "claude" },
      { "<leader>r", group = "replace" },
      { "<leader>m", group = "markdown" },
      { "<leader>k", group = "shell" },
      { "<leader>y", group = "yank" },
    },
  },
}
