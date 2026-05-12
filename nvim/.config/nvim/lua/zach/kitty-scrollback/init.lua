local M = {}

function M.setup()
  -- Catppuccin Mocha palette
  vim.api.nvim_set_hl(0, "KsbUserHeader", { fg = "#89b4fa", bold = true }) -- blue
  vim.api.nvim_set_hl(0, "KsbAssistantHeader", { fg = "#cba6f7", bold = true }) -- mauve
  vim.api.nvim_set_hl(0, "KsbSeparator", { fg = "#585b70" }) -- surface2
  vim.api.nvim_set_hl(0, "KsbToolCall", { fg = "#89dceb", bold = true }) -- teal
  vim.api.nvim_set_hl(0, "KsbToolDetail", { fg = "#6c7086", italic = true }) -- overlay0
  vim.api.nvim_set_hl(0, "KsbTimestamp", { fg = "#6c7086" }) -- overlay0
  vim.api.nvim_set_hl(0, "KsbOutput", { fg = "#a6adc8" }) -- subtext0
  vim.api.nvim_set_hl(0, "KsbOutputBorder", { fg = "#45475a" }) -- surface1
  vim.api.nvim_set_hl(0, "KsbCodeFence", { fg = "#45475a" }) -- surface1
  vim.api.nvim_set_hl(0, "KsbCodeLang", { fg = "#f9e2af" }) -- yellow
end

function M.launch(data_str)
  local ok, data = pcall(vim.fn.json_decode, data_str)
  if not ok then
    vim.notify("kitty-scrollback: failed to parse data", vim.log.levels.ERROR)
    return
  end

  if data.mode == "claude" and data.conversation_file then
    require("zach.kitty-scrollback.claude").open(data)
  else
    require("zach.kitty-scrollback.scrollback").open(data)
  end
end

return M
