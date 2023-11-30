return {
  {
    "akinsho/toggleterm.nvim",
    config = function()
      require("toggleterm").setup()

      local Terminal = require('toggleterm.terminal').Terminal

      local lazygit  = Terminal:new({
        cmd = "lazygit",
        hidden = true,
        direction = "float",
      })
      local function lazygit_toggle()
        lazygit:toggle()
      end
      vim.keymap.set("n", "<leader>gt", lazygit_toggle, { noremap = true, silent = true })
    end,
  }
}
