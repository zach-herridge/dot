return {
  {
    "akinsho/toggleterm.nvim",
    config = function()
      require("toggleterm").setup()

      local Terminal = require('toggleterm.terminal').Terminal

      local lazygit  = Terminal:new({
        cmd = "lazygit",
        hidden = true,
        dir = "git_dir",
        direction = "float",
      })
      local function toggleLazyGit()
        lazygit:toggle()
      end
      vim.keymap.set("n", "<leader>gh", toggleLazyGit, { desc = "Open lazygit" })
    end,
  }
}
