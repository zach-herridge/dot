return {
  "mbbill/undotree",
  keys = {
    { "<leader>u", "<cmd>UndotreeToggle<cr>", desc = "Toggle Undo Tree" },
  },
  config = function()
    -- Persistent-undo (undofile/undodir) lives in core/options.lua so it's set
    -- at startup regardless of when this lazy plugin loads. Only undotree's own
    -- display options belong here.
    vim.g.undotree_WindowLayout = 2 -- Layout with diff window
    vim.g.undotree_SplitWidth = 30
    vim.g.undotree_DiffpanelHeight = 10
    vim.g.undotree_SetFocusWhenToggle = 1 -- Focus undotree when opened
    vim.g.undotree_ShortIndicators = 1 -- Use short time indicators
  end,
}
