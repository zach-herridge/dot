local function bemol()
  local bemol_dir = vim.fs.find({ '.bemol' }, { upward = true, type = 'directory' })[1]
  local ws_folders_lsp = {}
  if bemol_dir then
    local file = io.open(bemol_dir .. '/ws_root_folders', 'r')
    if file then
      for line in file:lines() do
        table.insert(ws_folders_lsp, line)
      end
      file:close()
    end
  end

  for _, line in ipairs(ws_folders_lsp) do
    vim.lsp.buf.add_workspace_folder(line)
  end
end

local function setup_on_attach(on_attach)
  vim.api.nvim_create_autocmd("LspAttach", {
    callback = function(args)
      local buffer = args.buf
      local client = vim.lsp.get_client_by_id(args.data.client_id)
      on_attach(client, buffer)
    end
  })
end

return {
  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = {
      {
        "williamboman/mason.nvim",
        opts = {
          ui = {
            icons = {
              package_installed = "✓",
              package_pending = "➜",
              package_uninstalled = "✗",
            },
          },
        },
      },
      "williamboman/mason-lspconfig.nvim",
      "WhoIsSethDaniel/mason-tool-installer.nvim",
      "hrsh7th/cmp-nvim-lsp",
      { "j-hui/fidget.nvim",                   tag = "legacy", opts = {}, event = "LspAttach" },
      { "antosha417/nvim-lsp-file-operations", config = true },
    },
    opts = {
      inlay_hints = { enabled = true },
      servers = {},
      setup = {},
    },
    config = function(_, opts)
      local on_attach = function(client, bufnr)
        if client.server_capabilities.inlayHintProvider then
          vim.lsp.inlay_hint(bufnr, true)
        end

        local nmap = function(keys, func, desc)
          vim.keymap.set("n", keys, func, { desc = desc })
        end

        bemol()

        nmap("<leader>cr", vim.lsp.buf.rename, "Lsp rename")
        nmap("<leader>ca", vim.lsp.buf.code_action, "Lsp code action")
        nmap("<leader>cf", vim.lsp.buf.format, "Lsp format")

        nmap("gd", vim.lsp.buf.definition, "Go to lsp definition")
        nmap("gD", vim.lsp.buf.declaration, "Go to lsp declaration")

        nmap("<leader>gr", require("telescope.builtin").lsp_references, "Go to lsp references")
        nmap("<leader>gI", require("telescope.builtin").lsp_implementations, "Go to lsp implementations")
        nmap("<leader>gt", vim.lsp.buf.type_definition, "Go to lsp type definition")

        nmap("<leader>fe", require("telescope.builtin").lsp_document_symbols, "Find lsp document symbols")
        nmap("<leader>fE", require("telescope.builtin").lsp_dynamic_workspace_symbols, "Find lsp document symbols global")

        nmap("K", vim.lsp.buf.hover, "Hover Documentation")
        nmap("<C-k>", vim.lsp.buf.signature_help, "Signature documentation")
        vim.keymap.set("i", "<C-k>", vim.lsp.buf.signature_help, { desc = "Signature documentation" })

        nmap("<leader>lwa", vim.lsp.buf.add_workspace_folder, "Add dir to workspace")
        nmap("<leader>lwr", vim.lsp.buf.remove_workspace_folder, "Remove dir from workspace")
        nmap("<leader>lwl", function()
          vim.notify(vim.inspect(vim.lsp.buf.list_workspace_folders()))
        end, "List workspace dirs")
      end
      setup_on_attach(on_attach)

      local cmp_nvim_lsp = require("cmp_nvim_lsp")
      local capabilities = vim.tbl_deep_extend(
        "force",
        {},
        vim.lsp.protocol.make_client_capabilities(),
        cmp_nvim_lsp.default_capabilities(),
        opts.capabilities or {}
      )
      local servers = opts.servers
      local function setup_server(server)
        local server_opts = vim.tbl_deep_extend("force", {
          capabilities = vim.deepcopy(capabilities),
        }, servers[server] or {})
        if opts.setup[server] then
          if opts.setup[server](server, server_opts) then
            return
          end
        end
        require("lspconfig")[server].setup(server_opts)
      end


      local mlsp = require("mason-lspconfig")
      local all_mslp_servers = vim.tbl_keys(require("mason-lspconfig.mappings.server").lspconfig_to_package)

      local ensure_installed = {}
      for server, server_opts in pairs(servers) do
        if server_opts then
          server_opts = server_opts == true and {} or server_opts
          if server_opts.mason == false or not vim.tbl_contains(all_mslp_servers, server) then
            setup_server(server)
          else
            ensure_installed[#ensure_installed + 1] = server
          end
        end
      end
      mlsp.setup({ ensure_installed = ensure_installed, handlers = { setup_server } })
    end,
  },
}
