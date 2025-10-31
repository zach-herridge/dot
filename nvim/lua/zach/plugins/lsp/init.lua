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
        -- Servers will be added by language files
      },
    },
    config = function(_, opts)
      local mason_bin = vim.fn.stdpath("data") .. "/mason/bin"
      vim.env.PATH = mason_bin .. ":" .. vim.env.PATH
      
      local lspconfig = require("lspconfig")
      local keymaps = require("zach.plugins.lsp.keymaps")

      for server, server_opts in pairs(opts.servers) do
        if lspconfig[server] then
          server_opts.on_attach = keymaps.on_attach
          lspconfig[server].setup(server_opts)
        end
      end
    end,
  },
}
