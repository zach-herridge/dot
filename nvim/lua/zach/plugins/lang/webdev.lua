return {
  {
    "nvim-treesitter/nvim-treesitter",
    opts = function(_, opts)
      vim.list_extend(opts.ensure_installed, {
        "css",
        "html",
        "javascript",
        "xml",
      })
    end,
  },
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        tsserver = {},
        html = {},
        cssls = {},
        tailwindcss = {},
      },
    },
  },
}
