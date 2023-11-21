return {
  "rlane/pounce.nvim",
  config = function()
    local pounce = require("pounce")
    pounce.setup {
      accept_keys = "JFKDLSAHGNUVRBYTMICEOXWPQZ",
      accept_best_key = "<enter>",
      multi_window = true,
      debug = false,
    }

    local map = vim.keymap.set
    map("n", "s", function() pounce.pounce {} end)
    map("n", "S", function() pounce.pounce { do_repeat = true } end)
    map("x", "s", function() pounce.pounce {} end)
  end
}

-- Figure this out
-- highlight PounceMatch gui=bold guifg=#555555 guibg=#11dd11
-- highlight PounceGap gui=bold guifg=#555555 guibg=#00aa00
-- highlight PounceAccept gui=bold guifg=#111111 guibg=#de940b
