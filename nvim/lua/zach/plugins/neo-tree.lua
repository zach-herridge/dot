return {
  "nvim-neo-tree/neo-tree.nvim",
  branch = "v3.x",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-tree/nvim-web-devicons",
    "MunifTanjim/nui.nvim",
  },
  keys = {
    { "<leader>gC", function()
      require("neo-tree.command").execute({
        source = "git_status",
        position = "left",
        toggle = true,
      })
    end, desc = "Git status sidebar" },
  },
  opts = {
    sources = { "filesystem", "buffers", "git_status" },
    git_status = {
      window = {
        position = "left",
        width = 40,
      },
      renderers = {
        file = {
          { "indent", with_expanders = false },
          { "icon" },
          { "name", use_git_status_colors = true },
          { "git_status" },
        },
      },
      group_empty_dirs = false,
      follow_current_file = {
        enabled = false,
      },
      hijack_netrw_behavior = "disabled",
    },
    default_component_configs = {
      git_status = {
        symbols = {
          added     = "✚",
          modified  = "",
          deleted   = "✖",
          renamed   = "󰁕",
          untracked = "",
          ignored   = "",
          unstaged  = "󰄱",
          staged    = "",
          conflict  = "",
        }
      },
    },
  },
}
