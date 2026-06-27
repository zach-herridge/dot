-- pane-viewer — View a tmux pane's scrollback, or the Claude Code conversation
-- running in it, inside a full-screen nvim popup.
--
-- Entry point: pane-viewer is launched by `tmux popup` running
--   nvim -c "lua require('zach.pane-viewer').launch()"
-- with these environment variables set by the tmux binding:
--   ZACH_PV_MODE  = "auto" | "scrollback" | "claude"   (default "auto")
--   ZACH_PV_PANE  = the originating pane id (e.g. "%11")
--
-- In "auto" mode we show the Claude conversation if this pane is running a
-- Claude session, otherwise the raw scrollback. All detection and capture
-- happen here in Lua — the shell side only opens the popup.

local M = {}

local SCROLLBACK_LINES = 10000

--- Catppuccin Mocha palette for the Claude conversation renderer.
local function set_highlights()
  local hl = {
    PaneViewerUserHeader = { fg = "#89b4fa", bold = true }, -- blue
    PaneViewerAssistantHeader = { fg = "#cba6f7", bold = true }, -- mauve
    PaneViewerSeparator = { fg = "#585b70" }, -- surface2
    PaneViewerToolCall = { fg = "#89dceb", bold = true }, -- teal
    PaneViewerToolDetail = { fg = "#6c7086", italic = true }, -- overlay0
    PaneViewerTimestamp = { fg = "#6c7086" }, -- overlay0
    PaneViewerOutput = { fg = "#a6adc8" }, -- subtext0
    PaneViewerOutputBorder = { fg = "#45475a" }, -- surface1
    PaneViewerCodeFence = { fg = "#45475a" }, -- surface1
    PaneViewerCodeLang = { fg = "#f9e2af" }, -- yellow
  }
  for group, opts in pairs(hl) do
    vim.api.nvim_set_hl(0, group, opts)
  end
end

--- One-time setup invoked by the plugin spec's config().
function M.setup()
  set_highlights()
end

--- Main entry point, called from the popup's nvim instance.
function M.launch()
  local mode = vim.env.ZACH_PV_MODE
  if mode == nil or mode == "" then
    mode = "auto"
  end

  local pane_id = vim.env.ZACH_PV_PANE
  if not pane_id or pane_id == "" then
    require("zach.pane-viewer.ui").show_message(
      "No pane id provided (ZACH_PV_PANE is unset)."
    )
    return
  end

  require("zach.pane-viewer.clipboard").install()

  local tmux = require("zach.pane-viewer.tmux")
  local pane_pid = tonumber(tmux.pane_var(pane_id, "#{pane_pid}"))
  local pane_cwd = tmux.pane_var(pane_id, "#{pane_current_path}")

  -- Resolve which view to show.
  local session, match_count
  if mode ~= "scrollback" then
    session, match_count =
      require("zach.pane-viewer.detect").find_session_for_pane(pane_pid, pane_cwd)
  end

  if mode == "claude" and not session then
    require("zach.pane-viewer.ui").show_message(
      "No Claude conversation found for this pane."
    )
    return
  end

  if session and mode ~= "scrollback" then
    require("zach.pane-viewer.claude").open({
      conversation_file = session.conversation,
      session_cwd = session.cwd,
      ambiguous = match_count > 1,
    })
  else
    local lines = tmux.capture_scrollback(pane_id, SCROLLBACK_LINES)
    require("zach.pane-viewer.scrollback").open({ lines = lines })
  end
end

return M
