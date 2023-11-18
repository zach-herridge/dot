return {
  "catppuccin/nvim",
  name = "catppuccin",
  priority = 1000,
  config = function()
    require("catppuccin").setup({
      flavour = "mocha",
      integrations = {
        neotree = true,
        gitgutter = true,
        leap = true
      }
    })
    vim.cmd.colorscheme "catppuccin"
  end
}
