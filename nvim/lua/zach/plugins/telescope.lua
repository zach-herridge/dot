return {
  "nvim-telescope/telescope.nvim",
  branch = "0.1.x",
  dependencies = {
    "nvim-lua/plenary.nvim",
    { "nvim-telescope/telescope-fzf-native.nvim", build = "make" },
    "nvim-tree/nvim-web-devicons",
  },
  config = function()
    local telescope = require("telescope")

    telescope.setup({
      defaults = {
        path_display = { truncate = 3 },
        file_ignore_patterns = {
          "^build",
          "^.bemol",
          "^repo",
          "^env",
          "node_modules",
        },
      },
    })

    telescope.load_extension("fzf")

    local keymap = vim.keymap

    keymap.set("n", "<leader>ff", "<cmd>Telescope find_files<cr>", { desc = "Fuzzy find files in cwd" })
    keymap.set("n", "<leader>fr", "<cmd>Telescope oldfiles<cr>", { desc = "Fuzzy find recent files" })
    keymap.set("n", "<leader>fS", "<cmd>Telescope live_grep<cr>", { desc = "Find string in cwd" })
    keymap.set("n", "<leader>fs", "<cmd>Telescope current_buffer_fuzzy_find<cr>", { desc = "Find string in current file" })
    keymap.set("n", "<leader>fR", "<cmd>Telescope resume<cr>", { desc = "Resume last search" })
    keymap.set("n", "<leader>fX", "<cmd>Telescope diagnostics<cr>", { desc = "Find diagnostics" })
    keymap.set("n", "<leader>ft", "<cmd>Telescope treesitter<cr>", { desc = "Find treesitter" })
  end,
}
