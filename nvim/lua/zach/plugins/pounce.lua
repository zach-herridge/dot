return {
  "zach-herridge/pounce",
  config = function()
    local pounce = require("pounce")
    pounce.setup {
      accept_keys = ">JFKDLSAHGNUVRBYTMICEOXWPQZ",
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
      fg = "#1e1e2e",
      bg = "#809dff",
    }

    local default_hl_config_best = {
      bold = true,
      fg = "#1e1e2e",
      bg = "#a6e3a1",
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

