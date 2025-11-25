return {
  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = { "mason-org/mason.nvim" },
    config = function()
      -- Create capabilities for blink.cmp
      local capabilities = vim.lsp.protocol.make_client_capabilities()
      capabilities.textDocument.completion.completionItem.snippetSupport = true
      capabilities.textDocument.completion.completionItem.resolveSupport = {
        properties = { 'documentation', 'detail', 'additionalTextEdits' }
      }

      -- Global LSP settings
      vim.lsp.config('*', {
        capabilities = capabilities,
        root_markers = { '.git' },
      })

      -- Get Mason bin path
      local mason_bin = vim.fn.stdpath("data") .. "/mason/bin/"

      -- Kotlin LSP (modern official server)
      vim.lsp.config('kotlin_lsp', {
        cmd = { mason_bin .. 'kotlin-lsp', '--stdio' },
        filetypes = { 'kotlin' },
        root_markers = { 'settings.gradle', 'settings.gradle.kts', 'build.gradle', 'build.gradle.kts' },
      })

      -- TypeScript LSP (using vtsls from Mason)
      vim.lsp.config('vtsls', {
        cmd = { mason_bin .. 'vtsls', '--stdio' },
        filetypes = { 'javascript', 'javascriptreact', 'typescript', 'typescriptreact' },
        root_markers = { 'package.json', 'tsconfig.json', 'jsconfig.json' },
      })

      -- Lua LSP
      vim.lsp.config('lua_ls', {
        cmd = { mason_bin .. 'lua-language-server' },
        filetypes = { 'lua' },
        root_markers = { '.luarc.json', '.luarc.jsonc' },
        settings = {
          Lua = {
            runtime = { version = 'LuaJIT' },
            workspace = {
              checkThirdParty = false,
              library = { vim.env.VIMRUNTIME },
            },
          },
        },
      })

      -- Enable all configs
      vim.lsp.enable({ 'kotlin_lsp', 'vtsls', 'lua_ls' })

      -- Keymaps and attach logic
      local bemol_loaded = {}
      vim.api.nvim_create_autocmd('LspAttach', {
        callback = function(args)
          local client = vim.lsp.get_client_by_id(args.data.client_id)
          local bufnr = args.buf
          local opts = { buffer = bufnr, silent = true }

          -- Keymaps
          vim.keymap.set("n", "K", vim.lsp.buf.hover, opts)
          vim.keymap.set("n", "<loader>ck", vim.lsp.buf.signature_help, opts)
          vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, opts)
          vim.keymap.set("n", "<leader>cr", vim.lsp.buf.rename, opts)
          vim.keymap.set("n", "<leader>cd", vim.diagnostic.open_float, opts)
          vim.keymap.set("n", "<leader>ch", function()
            vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
          end, opts)

          -- Enable inlay hints if supported
          if client.supports_method and client.supports_method("textDocument/inlayHint") then
            vim.lsp.inlay_hint.enable(true, { bufnr = bufnr })
          end

          -- Bemol workspace folders (Amazon development)
          if not bemol_loaded[client.id] then
            local bemol_dir = vim.fs.find({ '.bemol' }, { upward = true, type = 'directory' })[1]
            if bemol_dir then
              local ws_folders_file = bemol_dir .. '/ws_root_folders'
              local file = io.open(ws_folders_file, 'r')
              if file then
                for line in file:lines() do
                  vim.lsp.buf.add_workspace_folder(line)
                end
                file:close()
                bemol_loaded[client.id] = true
              end
            end
          end
        end,
      })
    end,
  },
}
