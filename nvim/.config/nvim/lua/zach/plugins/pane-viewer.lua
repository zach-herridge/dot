-- Local plugin: view a tmux pane's scrollback or its Claude Code conversation
-- in a full-screen nvim popup. Launched by the tmux binding via
--   nvim -c "lua require('zach.pane-viewer').launch()"
-- Loads on the PaneViewerLaunch user event so it costs nothing in normal nvim.
return {
  "pane-viewer",
  dev = true,
  dir = vim.fn.stdpath("config") .. "/lua/zach/pane-viewer",
  lazy = true,
  event = { "User PaneViewerLaunch" },
  config = function()
    require("zach.pane-viewer").setup()
  end,
}
