return {
  {
    "nvim-telescope/telescope-file-browser.nvim",
    dependencies = { "nvim-telescope/telescope.nvim", "nvim-lua/plenary.nvim" },
    config = function()
      vim.keymap.set("n", "<leader>fB", "<cmd>Telescope file_browser<cr>", { desc = "File browser" })
      vim.keymap.set("n", "<leader>fb", "<cmd>Telescope file_browser path=%:p:h select_buffer=true<cr>",
        { desc = "File browser current dir" })

      require("telescope").load_extension("file_browser")
    end
  },
}
