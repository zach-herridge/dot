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
    explorer = { enabled = false },
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
    { "<leader>sn", function() Snacks.notifier.show_history() end, desc = "Notification History" },
    { "<leader>gg", function()
      local git_utils = require("zach.utils.git")
      local git_root = git_utils.find_git_root()
      if git_root then
        Snacks.lazygit({ cwd = git_root })
      else
        Snacks.lazygit()
      end
    end, desc = "Lazygit" },

    { "<leader>fd", function() Snacks.picker.files({ cwd = vim.fn.expand('%:p:h') }) end, desc = "Find in file dir" },
    { "<leader><space>", function() Snacks.picker.resume() end, desc = "Find files smart"},
    { "<leader>ff", function() Snacks.picker.files() end, desc = "Find files" },
    { "<leader>fr", function() Snacks.picker.recent() end, desc = "Find files" },
    { "<leader>fg", function() Snacks.picker.grep() end, desc = "Find string in cwd" },
    { "<leader>fw", function() Snacks.picker.grep_word() end, desc = "Find word under cursor" },
    { "<leader>fs", function() Snacks.picker.lines() end, desc = "Find string in current file" },
    { "<leader>fu", function() Snacks.picker.undo() end, desc = "Find undo states" },
    { "<leader>fX", function() Snacks.picker.diagnostics() end, desc = "Find diagnostics" },
    { "<leader>cs", function() Snacks.picker.spelling() end, desc = "Get spelling help" },

    { "<leader>fH", function() Snacks.picker.help() end, desc = "Find help docs" },

    { "gd", function() Snacks.picker.lsp_definitions() end, desc = "Go to definition" },
    { "gr", function() Snacks.picker.lsp_references() end, desc = "Go to references" },
    { "gI", function() Snacks.picker.lsp_implementations() end, desc = "Go to implementations" },
    { "gy", function() Snacks.picker.lsp_type_definitions() end, desc = "Go to type definitions" },
  },

  config = function(_, opts)
    local rg = require("zach.utils.ripgrep")

    -- Update picker sources
    opts.picker = opts.picker or {}
    opts.picker.sources = {
      grep = {
        cmd = "rg",
        args = rg.make_args(),
        parse_args = true,
      },
      grep_word = {
        cmd = "rg",
        args = rg.make_args({"--word-regexp"}),
      },
    }

    require("snacks").setup(opts)
    Snacks.toggle.diagnostics():map("<leader>td")
    Snacks.toggle.option("spell"):map("<leader>ts")
    Snacks.toggle.line_number():map("<leader>to")
    Snacks.toggle.option("wrap"):map("<leader>tw")
  end,
}
