return {
  "nvim-neo-tree/neo-tree.nvim",
  branch = "v3.x",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-tree/nvim-web-devicons",
    "MunifTanjim/nui.nvim",
    "3rd/image.nvim",
  },
  config = function()
    require("neo-tree").setup({
      close_if_last_window = false,
      popup_border_style = "rounded",
      enable_git_status = false,
      enable_diagnostics = false,
      enable_normal_mode_for_inputs = true,
      hijack_netrw_behavior = "open_default",
      open_files_do_not_replace_types = { "terminal", "trouble", "qf" },
      filesystem = {
        follow_current_file = {
          enabled = true,
          leave_dirs_open = false,
        },
        filtered_items = {
          visible = true
        }
      },
      buffers = {
        follow_current_file = {
          enabled = true,
          leave_dirs_open = false,
        }
      }
    })

    vim.keymap.set("n", "<leader>fd", "<cmd>Neotree reveal<cr>", { desc = "File browser" })
  end
}
