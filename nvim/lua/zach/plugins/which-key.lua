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
      { "<leader>s", group = "search/symbols" },
      { "<leader>c", group = "code" },
      { "<leader>o", group = "open" },
      { "<leader>t", group = "toggle/terminal" },
      { "<leader>r", group = "replace" },
    },
  },
}
