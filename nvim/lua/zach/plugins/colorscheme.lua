return {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000,
    config = function()
        require("catppuccin").setup({
            term_colors = true,
            color_overrides = {
                mocha = {
                    base = "#202020",
                    mantle = "#202020",
                    crust = "#202020",
                },
            },
        })
        vim.cmd.colorscheme "catppuccin-mocha"
    end,
}

