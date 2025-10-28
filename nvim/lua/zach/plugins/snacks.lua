return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  dependencies = {
    "nvim-tree/nvim-web-devicons",
  },
  opts = {
    bigfile = { enabled = true },
    notifier = { enabled = true },
    quickfile = { enabled = true },
    statuscolumn = { enabled = true },
    words = { enabled = false },
    explorer = { enabled = true },
    git = { enabled = true },
    picker = { enabled = true },
    indent = { enabled = false },
    input = { enabled = true },
    scroll = { enabled = false },
    terminal = { enabled = true },
    toggle = { enabled = true },
    zen = { enabled = true },
  },
  keys = {
    { "<leader>fD", function() Snacks.explorer() end, desc = "File browser" },
    { "<leader>sn", function() Snacks.notifier.show_history() end, desc = "Notification History" },
    { "<leader>gg", function() Snacks.lazygit() end, desc = "Lazygit" },

    { "<leader>fd", function() Snacks.picker.files({ cwd = vim.fn.expand('%:p:h') }) end, desc = "Find in file dir" },
    { "<leader><space>", function() Snacks.picker.smart() end, desc = "Find files smart"},
    { "<leader>ff", function() Snacks.picker.files() end, desc = "Find files" },
    { "<leader>fg", function() Snacks.picker.grep() end, desc = "Find string in cwd" },
    { "<leader>fw", function() Snacks.picker.grep_word() end, desc = "Find word under cursor" },
    { "<leader>fs", function() Snacks.picker.lines() end, desc = "Find string in current file" },
    { "<leader>fR", function() Snacks.picker.resume() end, desc = "Resume last search" },
    { "<leader>fX", function() Snacks.picker.diagnostics() end, desc = "Find diagnostics" },
    { "<leader>ft", function() Snacks.picker.treesitter() end, desc = "Find treesitter" },
    { "<leader>fH", function() Snacks.picker.help() end, desc = "Find help docs" },
    { "<leader>cs", function() Snacks.picker.spelling() end, desc = "Get spelling help" },

    { "<leader>fb", function() Snacks.picker.buffers() end, desc = "Find buffers" },
    { "<leader>fr", function() Snacks.picker.recent() end, desc = "Find recent files" },

    { "gd", function() Snacks.picker.lsp_definitions() end, desc = "Go to definition" },
    { "gr", function() Snacks.picker.lsp_references() end, desc = "Go to references" },
    { "gI", function() Snacks.picker.lsp_implementations() end, desc = "Go to implementations" },
    { "gy", function() Snacks.picker.lsp_type_definitions() end, desc = "Go to type definitions" },

    { "<leader>ss", function() Snacks.picker.lsp_symbols() end, desc = "LSP symbols" },
    { "<leader>sS", function() Snacks.picker.lsp_workspace_symbols() end, desc = "LSP workspace symbols" },

    { "<leader>gc", function() Snacks.picker.git_status() end, desc = "Git changed files" },
    { "<leader>gf", function() Snacks.picker.git_files() end, desc = "Git files" },
    { "<leader>fgb", function() Snacks.picker.git_branches() end, desc = "Git branches" },

    { "<leader>tt", function() Snacks.terminal() end, desc = "Terminal" },
    { "<leader>tz", function() Snacks.zen() end, desc = "Zen mode" },
  },

  config = function(_, opts)
    require("snacks").setup(opts)
    Snacks.toggle.diagnostics():map("<leader>td")
    Snacks.toggle.option("spell"):map("<leader>ts")
    Snacks.toggle.line_number():map("<leader>to")
    Snacks.toggle.option("wrap"):map("<leader>tw")
  end,
}
