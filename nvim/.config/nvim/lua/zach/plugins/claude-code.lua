return {
  "greggh/claude-code.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
  },
  keys = {
    { "<C-,>", desc = "Toggle Claude Code" },
    { "<leader>tcc", "<cmd>ClaudeCode<cr>", desc = "Toggle Claude Code" },
    { "<leader>tcr", "<cmd>ClaudeCodeResume<cr>", desc = "Resume conversation" },
    { "<leader>tcs", "<cmd>ClaudeCodeContinue<cr>", desc = "Continue last session" },
  },
  opts = {
    window = {
      split_ratio = 0.4,
      position = "vertical",
      enter_insert = true,
      hide_numbers = true,
      hide_signcolumn = true,
    },
    refresh = {
      enable = true,
      updatetime = 100,
      timer_interval = 1000,
      show_notifications = true,
    },
    git = {
      use_git_root = true,
    },
    keymaps = {
      toggle = {
        normal = "<C-,>",
        terminal = "<C-,>",
        variants = {
          continue = "<leader>tcs",
          verbose = "<leader>tcv",
        },
      },
      window_navigation = true,
      scrolling = true,
    },
  },
}
