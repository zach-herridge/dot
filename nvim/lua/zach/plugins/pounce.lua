return {
  "zach-herride/pounce.nvim",
  config = function()
    local pounce = require("pounce")
    pounce.setup {
      accept_keys = "JFKDLSAHGNUVRBYTMICEOXWPQZ",
      accept_best_key = "<enter>",
      multi_window = true,
      debug = false,
    }

    local default_hl_config = {
      fg = "#cdd6f4",
      bg = "#3e5767",
    }

    local default_hl_config_bold = {
      bold = true,
      fg = "#cdd6f4",
      bg = "#3e5767",
    }

    local default_hl_config_best = {
      bold = true,
      fg = "#cdd6f4",
      bg = "#287bb0",
    }

    local default_hl = {
      PounceMatch = default_hl_config,
      PounceUnmatched = {
        link = "None",
      },
      PounceGap = default_hl_config,
      PounceAccept = default_hl_config_bold,
      PounceAcceptBest = default_hl_config_best,
      PounceCursor = default_hl_config,
      PounceCursorGap = default_hl_config,
      PounceCursorAccept = default_hl_config_bold,
      PounceCursorAcceptBest = default_hl_config_best,
    }

    for hl, spec in pairs(default_hl) do
      vim.api.nvim_set_hl(0, hl, spec)
    end


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
