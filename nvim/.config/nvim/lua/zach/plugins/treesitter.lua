return {
  {
    "nvim-treesitter/nvim-treesitter",
    branch = "main",
    event = { "BufReadPre", "BufNewFile" },
    build = ":TSUpdate",
    config = function()
      require("nvim-treesitter").setup({})

      -- Install parsers (main branch uses TSInstall, not ensure_installed)
      local installed = require("nvim-treesitter.config").get_installed()
      local ensure = {
        "sql", "gitcommit", "gitignore", "bash", "markdown", "markdown_inline",
        "kotlin", "java", "json", "css", "html", "javascript", "tsx",
        "typescript", "regex", "vim", "lua", "luadoc", "luap", "vimdoc", "yaml",
        "dockerfile", "git_config", "git_rebase", "graphql", "python", "xml",
        "toml",
      }
      local to_install = vim.tbl_filter(function(lang)
        return not vim.list_contains(installed, lang)
      end, ensure)
      if #to_install > 0 then
        require("nvim-treesitter.install").install(to_install, { summary = true })
      end

      -- Enable native treesitter features
      vim.api.nvim_create_autocmd("FileType", {
        callback = function(ev)
          pcall(vim.treesitter.start, ev.buf)
        end,
      })

      -- Incremental selection via treesitter nodes
      local node_stack = {}
      vim.keymap.set("n", "<C-space>", function()
        node_stack = {}
        local node = vim.treesitter.get_node()
        if not node then return end
        node_stack = { node }
        local sr, sc, er, ec = node:range()
        vim.fn.setpos("'<", { 0, sr + 1, sc + 1, 0 })
        vim.fn.setpos("'>", { 0, er + 1, ec, 0 })
        vim.cmd("normal! gv")
      end, { desc = "Init treesitter selection" })

      vim.keymap.set("x", "<C-space>", function()
        local node = node_stack[#node_stack]
        if not node then return end
        local parent = node:parent()
        if not parent then return end
        node_stack[#node_stack + 1] = parent
        local sr, sc, er, ec = parent:range()
        vim.fn.setpos("'<", { 0, sr + 1, sc + 1, 0 })
        vim.fn.setpos("'>", { 0, er + 1, ec, 0 })
        vim.cmd("normal! gv")
      end, { desc = "Expand treesitter selection" })

      vim.keymap.set("x", "<BS>", function()
        if #node_stack <= 1 then
          vim.cmd("normal! " .. vim.api.nvim_replace_termcodes("<Esc>", true, false, true))
          return
        end
        table.remove(node_stack)
        local node = node_stack[#node_stack]
        if not node then return end
        local sr, sc, er, ec = node:range()
        vim.fn.setpos("'<", { 0, sr + 1, sc + 1, 0 })
        vim.fn.setpos("'>", { 0, er + 1, ec, 0 })
        vim.cmd("normal! gv")
      end, { desc = "Shrink treesitter selection" })
    end,
  },
  {
    "nvim-treesitter/nvim-treesitter-textobjects",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = { "nvim-treesitter/nvim-treesitter" },
    config = function()
      require("nvim-treesitter-textobjects").setup({
        select = {
          lookahead = true,
        },
        move = {
          set_jumps = true,
        },
      })

      -- Textobject select keymaps
      local select = require("nvim-treesitter-textobjects.select")
      local map = vim.keymap.set
      map({ "x", "o" }, "af", function() select.select_textobject("@function.outer", "textobjects") end, { desc = "outer function" })
      map({ "x", "o" }, "if", function() select.select_textobject("@function.inner", "textobjects") end, { desc = "inner function" })
      map({ "x", "o" }, "ac", function() select.select_textobject("@class.outer", "textobjects") end, { desc = "outer class" })
      map({ "x", "o" }, "ic", function() select.select_textobject("@class.inner", "textobjects") end, { desc = "inner class" })
      map({ "x", "o" }, "aa", function() select.select_textobject("@parameter.outer", "textobjects") end, { desc = "outer parameter" })
      map({ "x", "o" }, "ia", function() select.select_textobject("@parameter.inner", "textobjects") end, { desc = "inner parameter" })
      map({ "x", "o" }, "ai", function() select.select_textobject("@conditional.outer", "textobjects") end, { desc = "outer conditional" })
      map({ "x", "o" }, "ii", function() select.select_textobject("@conditional.inner", "textobjects") end, { desc = "inner conditional" })
      map({ "x", "o" }, "al", function() select.select_textobject("@loop.outer", "textobjects") end, { desc = "outer loop" })
      map({ "x", "o" }, "il", function() select.select_textobject("@loop.inner", "textobjects") end, { desc = "inner loop" })
      map({ "x", "o" }, "a/", function() select.select_textobject("@comment.outer", "textobjects") end, { desc = "outer comment" })

      -- Move keymaps
      local move = require("nvim-treesitter-textobjects.move")
      map({ "n", "x", "o" }, "]f", function() move.goto_next_start("@function.outer", "textobjects") end, { desc = "Next function start" })
      map({ "n", "x", "o" }, "]c", function() move.goto_next_start("@class.outer", "textobjects") end, { desc = "Next class start" })
      map({ "n", "x", "o" }, "]a", function() move.goto_next_start("@parameter.inner", "textobjects") end, { desc = "Next parameter" })
      map({ "n", "x", "o" }, "[f", function() move.goto_previous_start("@function.outer", "textobjects") end, { desc = "Previous function start" })
      map({ "n", "x", "o" }, "[c", function() move.goto_previous_start("@class.outer", "textobjects") end, { desc = "Previous class start" })
      map({ "n", "x", "o" }, "[a", function() move.goto_previous_start("@parameter.inner", "textobjects") end, { desc = "Previous parameter" })

      -- Swap keymaps
      local swap = require("nvim-treesitter-textobjects.swap")
      map("n", "<leader>sa", function() swap.swap_next("@parameter.inner") end, { desc = "Swap next parameter" })
      map("n", "<leader>sA", function() swap.swap_previous("@parameter.inner") end, { desc = "Swap previous parameter" })
    end,
  },
}
