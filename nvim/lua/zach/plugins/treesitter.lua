return {
  {
    "nvim-treesitter/nvim-treesitter",
    event = { "BufReadPre", "BufNewFile" },
    build = ":TSUpdate",
    dependencies = {
      "windwp/nvim-ts-autotag",
    },
    opts = {
      ensure_installed = {
        "sql",
        "gitcommit",
        "gitignore",
        "bash",
        "markdown",
        "markdown_inline",
        "kotlin",
        "java",
        "json",
        "jsonc",
        "css",
        "html",
        "javascript",
        "tsx",
        "typescript",
        "regex",
        "vim",
        "lua",
        "luadoc",
        "luap",
        "vimdoc",
        "yaml",
        "dockerfile",
        "git_config",
        "git_rebase",
        "graphql",
        "python",
        "xml"
      },
      auto_install = true,
      highlight = { enable = true },
      indent = { enable = true },
      incremental_selection = {
        enable = true,
        keymaps = {
          init_selection = "<c-m>",
          node_incremental = "<c-m>",
          node_decremental = "<c-n>",
        },
      },
    },
    config = function(_, opts)
      require("nvim-treesitter.configs").setup(opts)
    end,
  },
  "nvim-treesitter/playground",
}
