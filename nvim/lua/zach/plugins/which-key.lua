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
      { "<leader>fd", desc = "Find in file dir" },
      { "<leader>ff", desc = "Find files" },
      { "<leader>fg", desc = "Find string in cwd" },
      { "<leader>fw", desc = "Find word under cursor" },
      { "<leader>fs", desc = "Find string in current file" },
      { "<leader>fR", desc = "Resume last search" },
      { "<leader>fX", desc = "Find diagnostics" },
      { "<leader>ft", desc = "Find treesitter" },
      { "<leader>fH", desc = "Find help docs" },
      { "<leader>fb", desc = "Find buffers" },
      { "<leader>fr", desc = "Find recent files" },
      { "<leader>fD", desc = "File browser" },
      { "<leader>fgb", desc = "Git branches" },
      
      { "<leader>g", group = "git" },
      { "<leader>gg", desc = "Lazygit" },
      { "<leader>gc", desc = "Git changed files" },
      { "<leader>gf", desc = "Git files" },
      { "<leader>gC", desc = "Git status sidebar" },
      
      { "<leader>h", group = "hunks" },
      { "<leader>hs", desc = "Stage hunk" },
      { "<leader>hr", desc = "Reset hunk" },
      
      { "<leader>s", group = "search/symbols" },
      { "<leader>sn", desc = "Notification History" },
      { "<leader>ss", desc = "LSP symbols" },
      { "<leader>sS", desc = "LSP workspace symbols" },
      
      { "<leader>c", group = "code" },
      { "<leader>cs", desc = "Get spelling help" },
      { "<leader>cP", desc = "Copy file path" },
      { "<leader>cR", desc = "Copy package reference" },
      
      { "<leader>t", group = "toggle/terminal" },
      { "<leader>tt", desc = "Terminal" },
      { "<leader>tz", desc = "Zen mode" },
      { "<leader>td", desc = "Toggle diagnostics" },
      { "<leader>ts", desc = "Toggle spell check" },
      { "<leader>to", desc = "Toggle line numbers" },
      { "<leader>tw", desc = "Toggle wrap" },
      
      { "<leader>r", group = "replace" },
      { "<leader>rs", desc = "Search and replace" },
    },
  },
}
