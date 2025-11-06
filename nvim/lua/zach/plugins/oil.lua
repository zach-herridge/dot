return {
  "stevearc/oil.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  opts = {
    default_file_explorer = true,
    delete_to_trash = true,
    skip_confirm_for_simple_edits = true,
    columns = { "icon" },
    view_options = {
      show_hidden = true,
      natural_order = true,
    },
    win_options = {
      wrap = false,
      signcolumn = "no",
      cursorcolumn = false,
      foldcolumn = "0",
      spell = false,
      list = false,
      number = false,
      relativenumber = false,
    },
    float = {
      padding = 0,
      max_width = 40,
      max_height = 1.0,
      border = "none",
      win_options = {
        winblend = 0,
      },
      override = function(conf)
        conf.anchor = "NW"
        conf.row = 0
        conf.col = 0
        conf.height = vim.o.lines
        return conf
      end,
    },
    keymaps = {
      ["g?"] = "actions.show_help",
      ["<C-v>"] = { "actions.select", opts = { vertical = true } },
      ["<C-h>"] = { "actions.select", opts = { horizontal = true } },
      ["<C-t>"] = { "actions.select", opts = { tab = true } },
      ["<C-p>"] = "actions.preview",
      ["<C-c>"] = "actions.close",
      ["<C-r>"] = "actions.refresh",
      ["-"] = "actions.parent",
      ["_"] = "actions.open_cwd",
      ["`"] = "actions.cd",
      ["~"] = "actions.tcd",
      ["gs"] = "actions.change_sort",
      ["gx"] = "actions.open_external",
      ["g."] = "actions.toggle_hidden",
      ["q"] = "actions.close",
    },
  },
  keys = {
    { "<leader>fD", function()
      require("oil").toggle_float()
    end, desc = "Toggle file browser" },
  },
}
