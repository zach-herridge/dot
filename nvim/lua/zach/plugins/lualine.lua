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
        disabled_filetypes = { statusline = { "dashboard", "alpha", "starter", "snacks_dashboard" } },
      },
      extensions = { "lazy" },
      sections = {
        lualine_a = { 'mode' },
        lualine_b = { 'branch' },
        lualine_c = {
          { 'filename', path = 1 },
          { 'diagnostics', sources = { 'nvim_diagnostic' } },
          {
            "macro-recording",
            fmt = show_macro_recording,
          }
        },
        lualine_x = { 'filetype' },
        lualine_y = { 'progress' },
        lualine_z = { 'location' }
      },
    })
  end
}
