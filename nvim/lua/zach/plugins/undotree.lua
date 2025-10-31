return {
  "mbbill/undotree",
  keys = {
    { "<leader>u", "<cmd>UndotreeToggle<cr>", desc = "Toggle Undo Tree" },
  },
  config = function()
    -- Enable persistent undo
    vim.opt.undofile = true
    vim.opt.undodir = vim.fn.stdpath("data") .. "/undo"
    
    -- Create undo directory if it doesn't exist
    vim.fn.mkdir(vim.fn.stdpath("data") .. "/undo", "p")
    
    -- Configure undotree
    vim.g.undotree_WindowLayout = 2 -- Layout with diff window
    vim.g.undotree_SplitWidth = 30
    vim.g.undotree_DiffpanelHeight = 10
    vim.g.undotree_SetFocusWhenToggle = 1 -- Focus undotree when opened
    vim.g.undotree_ShortIndicators = 1 -- Use short time indicators
  end,
}
