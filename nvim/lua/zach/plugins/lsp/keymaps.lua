local M = {}

local bemol_loaded = {}

function M.on_attach(client, bufnr)
  local opts = { buffer = bufnr, silent = true }

  vim.keymap.set("n", "K", vim.lsp.buf.hover, opts)
  vim.keymap.set("n", "gK", vim.lsp.buf.signature_help, opts)
  vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, opts)
  vim.keymap.set("n", "<leader>cr", vim.lsp.buf.rename, opts)
  vim.keymap.set("n", "<leader>ch", function()
    vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
  end, opts)

  if client.supports_method and client.supports_method("textDocument/inlayHint") then
    vim.lsp.inlay_hint.enable(true, { bufnr = bufnr })
  end

  -- Add Bemol workspace folders only once per client
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

        -- Add specific KAPT generated sources if they exist
        local project_root = vim.fs.dirname(bemol_dir)
        local kapt_dir = project_root .. '/build/PortageServiceCore/PortageServiceCore-1.0/AL2_x86_64/DEV.STD.PTHREAD/build/private/gradle/generated/source/kapt/main'
        if vim.fn.isdirectory(kapt_dir) == 1 and false then
          vim.lsp.buf.add_workspace_folder(kapt_dir)
        end

        bemol_loaded[client.id] = true
      end
    end
  end
end

return M
