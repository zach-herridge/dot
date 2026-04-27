return {
  "kitty-scrollback",
  dev = true,
  dir = vim.fn.stdpath("config") .. "/lua/zach/kitty-scrollback",
  lazy = true,
  event = { "User KittyScrollbackLaunch" },
  config = function()
    require("zach.kitty-scrollback").setup()
  end,
}
