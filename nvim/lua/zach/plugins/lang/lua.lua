return {
  {
    "nvim-treesitter/nvim-treesitter",
    opts = function(_, opts)
      vim.list_extend(opts.ensure_installed, {
        "lua",
        "vim",
        "vimdoc",
      })
    end,
  },
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      "folke/neoconf.nvim",
      { "folke/neodev.nvim", opts = {} },
    },
    opts = function(_, opts)
      opts.servers.lua_ls = {
        Lua = {
          -- make the language server recognize "vim" global
          diagnostics = {
            globals = { "vim" },
          },
          workspace = {
            checkThirdParty = false,
            workspace = {
              -- make language server aware of runtime files
              library = {
                [vim.fn.expand("$VIMRUNTIME/lua")] = true,
                [vim.fn.stdpath("config") .. "/lua"] = true,
              },
            },
          },
          telemetry = { enable = false },
        },
      }
    end,
  }
}
