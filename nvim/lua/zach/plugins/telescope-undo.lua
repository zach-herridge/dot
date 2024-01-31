return {
  "debugloop/telescope-undo.nvim",
  dependencies = {
    {
      "nvim-telescope/telescope.nvim",
      dependencies = { "nvim-lua/plenary.nvim" },
    },
  },
  keys = {
    {
      "<leader>fu",
      "<cmd>Telescope undo<cr>",
      desc = "undo history",
    },
  },
  config = function()
    require("telescope").setup()
    require("telescope").load_extension("undo")
  end,
}
