return {
  "A7Lavinraj/fyler.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  branch = "stable",
  opts = {
    icon_provider = "nvim_web_devicons",
    views = {
      finder = {
        default_explorer = true,
        delete_to_trash = true,
        confirm_simple = true,
        win = {
          kind = "split_left_most",
          kinds = {
            split_left_most = { width = "25%" }
          },
        }
      }
    }
  },
  keys = {
    { "<leader>fD", function()
      require("fyler").toggle({ kind = "split_left_most" })
    end, desc = "Toggle file browser" },
  },
}
