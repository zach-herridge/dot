return {
  "neovim/nvim-lspconfig",
  opts = {
    servers = {
      kotlin_language_server = {
        settings = {
          kotlin = {
            compiler = {
              jvm = {
                target = "1.8"
              }
            },
            inlayHints = {
              typeHints = true,
              parameterHints = true,
              chainingHints = true,
              variableTypeHints = true,
              functionReturnTypeHints = true,
              lambdaParameterHints = true,
              lambdaReturnTypeHints = true
            }
          }
        }
      }
    }
  }
}
