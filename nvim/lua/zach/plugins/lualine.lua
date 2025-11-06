return {
  "nvim-lualine/lualine.nvim",
  config = function()
    local function show_macro_recording()
      local recording_register = vim.fn.reg_recording()
      if recording_register == "" then
        return ""
      else
        return "Recording @" .. recording_register
      end
    end

    require('lualine').setup({
      options = {
        theme = "auto",
        globalstatus = true,
        disabled_filetypes = { statusline = { "dashboard", "alpha", "starter" } },
      },
      extensions = { "lazy" },
      sections = {
        lualine_a = { 'mode' },
        lualine_c = {
          { 'filename', path = 1 },
          {
            "macro-recording",
            fmt = show_macro_recording,
          }
        },
        lualine_x = {},
        lualine_y = {},
        lualine_z = { 'location' }
      },
    })
  end
}
