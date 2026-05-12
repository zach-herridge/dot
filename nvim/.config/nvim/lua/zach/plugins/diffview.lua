return {
  "sindrets/diffview.nvim",
  cmd = { "DiffviewOpen", "DiffviewClose", "DiffviewToggleFiles", "DiffviewFocusFiles" },
  keys = {
    {
      "<leader>od",
      function()
        vim.cmd("DiffviewOpen origin/mainline -- " .. vim.fn.expand("%"))
      end,
      desc = "Diff current file vs mainline"
    }
  },
  config = function()
    require("diffview").setup({
      keymaps = {
        view = {
          ["<tab>"] = require("diffview.actions").select_next_entry,
          ["<s-tab>"] = require("diffview.actions").select_prev_entry,
          ["gf"] = require("diffview.actions").goto_file,
          ["<C-w><C-f>"] = require("diffview.actions").goto_file_split,
          ["<C-w>gf"] = require("diffview.actions").goto_file_tab,
          ["<leader>e"] = require("diffview.actions").focus_files,
          ["<leader>b"] = require("diffview.actions").toggle_files,
        },
        file_panel = {
          ["j"] = require("diffview.actions").next_entry,
          ["k"] = require("diffview.actions").prev_entry,
          ["<cr>"] = require("diffview.actions").select_entry,
          ["o"] = require("diffview.actions").select_entry,
          ["<2-LeftMouse>"] = require("diffview.actions").select_entry,
          ["-"] = require("diffview.actions").toggle_stage_entry,
          ["S"] = require("diffview.actions").stage_all,
          ["U"] = require("diffview.actions").unstage_all,
          ["X"] = require("diffview.actions").restore_entry,
          ["R"] = require("diffview.actions").refresh_files,
          ["L"] = require("diffview.actions").open_commit_log,
          ["<c-b>"] = require("diffview.actions").scroll_view(-0.25),
          ["<c-f>"] = require("diffview.actions").scroll_view(0.25),
          ["<tab>"] = require("diffview.actions").select_next_entry,
          ["<s-tab>"] = require("diffview.actions").select_prev_entry,
          ["gf"] = require("diffview.actions").goto_file,
          ["<C-w><C-f>"] = require("diffview.actions").goto_file_split,
          ["<C-w>gf"] = require("diffview.actions").goto_file_tab,
          ["i"] = require("diffview.actions").listing_style,
          ["f"] = require("diffview.actions").toggle_flatten_dirs,
          ["<leader>e"] = require("diffview.actions").focus_files,
          ["<leader>b"] = require("diffview.actions").toggle_files,
        }
      }
    })
  end,
}
