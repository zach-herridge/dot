return {
  { import = "zach.plugins.lsp.lang" },

  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = {
      { "mason-org/mason-lspconfig.nvim", config = function() end },
    },
    opts = {
      servers = {
        kotlin_lsp = true,
        kotlin_language_server = false,
      },
    },
    config = function(_, opts)
    end,
  },
}
