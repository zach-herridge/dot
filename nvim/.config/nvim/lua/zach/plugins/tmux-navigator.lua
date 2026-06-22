return {
  "christoomey/vim-tmux-navigator",
  -- Load eagerly so <C-h/j/k/l> are mapped the instant nvim starts, not on
  -- first keypress (lazy-loading on these keys drops the very first motion).
  lazy = false,
}
