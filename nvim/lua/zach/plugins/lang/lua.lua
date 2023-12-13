return {
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      "folke/neoconf.nvim",
      { "folke/neodev.nvim", opts = {} },
    },
    opts = {
      servers = {
        lua_ls = {
          Lua = {
            diagnostics = {
              globals = { "vim" },
            },
            workspace = {
              checkThirdParty = false,
              workspace = {
                library = {
                  [vim.fn.expand("$VIMRUNTIME/lua")] = true,
                  [vim.fn.stdpath("config") .. "/lua"] = true,
                },
              },
            },
            telemetry = { enable = false },
          },
        }
      }
    }
  }
}
