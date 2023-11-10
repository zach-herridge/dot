return {
  "AckslD/nvim-neoclip.lua",
  dependencies = {
    { 'nvim-telescope/telescope.nvim' },
    { 'kkharji/sqlite.lua',           module = 'sqlite' },
  },
  config = function()
    require("neoclip").setup({
      enable_persistent_history = true
    })

    vim.keymap.set("n", "<leader>fc", "<cmd>Telescope neoclip<cr>", { desc = "Find in clipboard history" })

    require("telescope").load_extension("neoclip")
  end,
}
