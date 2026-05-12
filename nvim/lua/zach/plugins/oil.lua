return {
  "stevearc/oil.nvim",
  opts = {
    default_file_explorer = true,
    delete_to_trash = true,
    skip_confirm_for_simple_edits = true,
    view_options = {
      show_hidden = true,
    },
    float = {
      padding = 2,
      max_width = 0,
      max_height = 0,
      border = "rounded",
      win_options = {
        winblend = 0,
      },
    },
    keymaps = {
      -- Send file under cursor (or visual selection) to local ~/Downloads
      ["gt"] = {
        callback = function()
          local oil = require("oil")
          local dir = oil.get_current_dir()
          if not dir then return end

          local mode = vim.fn.mode()
          local paths = {}

          if mode == "V" or mode == "v" then
            -- Visual mode: collect all selected entries
            local start_line = vim.fn.line("'<")
            local end_line = vim.fn.line("'>")
            for lnum = start_line, end_line do
              vim.api.nvim_win_set_cursor(0, { lnum, 0 })
              local entry = oil.get_cursor_entry()
              if entry then
                table.insert(paths, dir .. entry.name)
              end
            end
            vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<Esc>", true, false, true), "n", false)
          else
            -- Normal mode: single file under cursor
            local entry = oil.get_cursor_entry()
            if entry then
              table.insert(paths, dir .. entry.name)
            end
          end

          if #paths > 0 then
            require("zach.transfer").send(paths, "~/Downloads/")
          end
        end,
        mode = { "n", "v" },
        desc = "Transfer file(s) to local",
      },
    },
  },
  keys = {
    { "<leader>fD", "<cmd>Oil<cr>", desc = "Open oil file browser" },
  },
}
