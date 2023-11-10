return {
  {
    "rcarriga/nvim-notify",
    dependencies = {
      "nvim-telescope/telescope.nvim",
    },
    lazy = false,
    priority = 900,
    config = function()
      local notify = require("notify")
      local level
      if os.getenv("DEBUG") then
        level = vim.log.levels.DEBUG
      else
        level = vim.log.levels.INFO
      end
      notify.setup({
        level = level,
      })
      vim.notify = notify
    end,
  },
}
