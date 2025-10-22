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

    local actions = require "telescope.actions"
    telescope.setup({
      defaults = {
        path_display = { truncate = 3 },
        mappings = {
          i = {
            ["<S-Tab>"] = actions.move_selection_next,
            ["<Tab>"] = actions.move_selection_previous,
          },
          n = {
            ["<S-Tab>"] = actions.move_selection_next,
            ["<Tab>"] = actions.move_selection_previous,
          }
        },
        file_ignore_patterns = {
          "^build",
          ".bemol",
          "^repo",
          "^env",
          "node_modules",
        },
      },
      pickers = {
        oldfiles = {
          cwd_only = true,
        },
        find_files = {
          find_command = { "rg", "--files", "--hidden", "--glob", "!**/.git/*" },
        },
      },
    })

    telescope.load_extension("fzf")

    local keymap = vim.keymap
    local builtin = require('telescope.builtin')
    keymap.set('n', '<leader>fd', function() builtin.find_files({ cwd = vim.fn.expand('%:p:h') }) end,
      { desc = "Find in file dir" })
    keymap.set("n", "<leader>ff", builtin.find_files, { desc = "Find files in cwd" })
    keymap.set("n", "<leader>fr", builtin.oldfiles, { desc = "Find recent files" })
    keymap.set("n", "<leader>fg", builtin.live_grep, { desc = "Find string in cwd" })
    keymap.set("n", "<leader>fs", builtin.current_buffer_fuzzy_find, { desc = "Find string in current file" })
    keymap.set("n", "<leader>fR", builtin.resume, { desc = "Resume last search" })
    keymap.set("n", "<leader>fX", builtin.diagnostics, { desc = "Find diagnostics" })
    keymap.set("n", "<leader>ft", builtin.treesitter, { desc = "Find treesitter" })
    keymap.set("n", "<leader>fH", builtin.help_tags, { desc = "Find help docs" })
    keymap.set("n", "<leader>cs", builtin.spell_suggest, { desc = "Get spelling help" })

    keymap.set("n", "<leader>fgb", builtin.git_branches, { desc = "Git branches" })
    keymap.set("n", "<leader>fc", builtin.git_status, { desc = "Git status" })
  end,
}
