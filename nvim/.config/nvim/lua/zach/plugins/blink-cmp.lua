return {
  'saghen/blink.cmp',
  -- Completion is only needed once you start editing, so load on first insert
  -- rather than at startup. (blink also attaches via LSP, so cmdline/term aren't
  -- affected.) Bumped off the stale v0.* pin to the current v1 line.
  event = 'InsertEnter',
  version = '1.*',
  opts = {
    keymap = {
      ['<C-space>'] = { 'show', 'show_documentation', 'hide_documentation' },
      ['<C-e>'] = { 'hide' },
      ['<C-y>'] = { 'select_and_accept' },

      ['<C-p>'] = { 'select_prev', 'fallback' },
      ['<C-n>'] = { 'select_next', 'fallback' },

      ['<Tab>'] = { 'select_next', 'fallback' },
      ['<S-Tab>'] = { 'select_prev', 'fallback' },

      ['<CR>'] = { 'accept', 'fallback' },
    },
    appearance = {
      use_nvim_cmp_as_default = true,
      nerd_font_variant = 'mono'
    },
    sources = {
      default = { 'lsp', 'path', 'buffer' },
    },
    completion = {
      accept = {
        auto_brackets = {
          enabled = true,
        },
      },
      list = {
        selection = {
          preselect = false,
          auto_insert = false,
        }
      },
      menu = {
        draw = {
          treesitter = { "lsp" },
          columns = { { "label", "label_description", gap = 1 }, { "kind_icon", "kind" } },
        }
      },
      documentation = {
        auto_show = true,
        auto_show_delay_ms = 200,
      }
    }
  },
  opts_extend = { "sources.default" }
}
