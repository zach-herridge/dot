return {
  'mikesmithgh/kitty-scrollback.nvim',
  enabled = true,
  lazy = true,
  cmd = { 'KittyScrollbackGenerateKittens', 'KittyScrollbackCheckHealth' },
  event = { 'User KittyScrollbackLaunch' },
  config = function()
    require('kitty-scrollback').setup({
      {
        status_window = {
          enabled = false,
        },
        paste_window = {
          yank_register_enabled = false,
        },
        keymaps_enabled = false,
        restore_options = true,
      },
    })
  end,
}
