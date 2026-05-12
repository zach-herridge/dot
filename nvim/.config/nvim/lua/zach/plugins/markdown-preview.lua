return {
  "selimacerbas/markdown-preview.nvim",
  dependencies = { "selimacerbas/live-server.nvim" },
  ft = "markdown",
  keys = {
    { "<leader>mps", "<cmd>MarkdownPreview<cr>", desc = "Start Preview" },
    { "<leader>mpr", "<cmd>MarkdownPreviewRefresh<cr>", desc = "Refresh Preview" },
    { "<leader>mpS", "<cmd>MarkdownPreviewStop<cr>", desc = "Stop Preview" },
  },
  opts = {},
}
