return {
  "git-status-panel",
  dev = true,
  dir = vim.fn.stdpath("config") .. "/lua/zach/git-status-panel",
  dependencies = {
    {
      "sindrets/diffview.nvim",
      opts = {
        keymaps = {
          view = {
            ["q"] = "<cmd>DiffviewClose<cr>",
          },
          file_panel = {
            ["q"] = "<cmd>DiffviewClose<cr>",
          },
          file_history_panel = {
            ["q"] = "<cmd>DiffviewClose<cr>",
          },
        },
        hooks = {
          diff_buf_read = function(bufnr)
            -- Disable conflicting plugins in diff buffers
            vim.api.nvim_buf_call(bufnr, function()
              if vim.fn.exists(":Gitsigns") > 0 then
                vim.cmd("Gitsigns detach")
              end
              -- Disable other potential conflicts
              vim.opt_local.cursorline = false
              vim.opt_local.cursorcolumn = false
              -- Disable swap files for diff buffers
              vim.opt_local.swapfile = false
            end)
          end,
        },
      },
    },
  },
  config = function()
    require("zach.git-status-panel").setup({
      refresh_interval = 2000,
      window = {
        position = "right",
        width = 40,
        height = 0.8,
      },
      show_line_counts = true,
    })
  end,
  keys = {
    { "<leader>gs", "<cmd>GitStatusPanel<cr>", desc = "Toggle Git Status Panel" },
    { "<leader>gS", "<cmd>GitStatusPanelUnstaged<cr>", desc = "Toggle Git Status Panel (Unstaged)" },
    { "<leader>gJ", function() require("zach.git-status-panel").jump_to_next_file() end, desc = "Jump to next git file" },
    { "<leader>gK", function() require("zach.git-status-panel").jump_to_prev_file() end, desc = "Jump to previous git file" },
  },
}
