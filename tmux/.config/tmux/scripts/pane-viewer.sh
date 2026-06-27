#!/usr/bin/env bash
# pane-viewer.sh — Open the scrollback / Claude-conversation viewer for a tmux
# pane in a full-screen nvim popup.
#
# Usage:
#   pane-viewer.sh [mode] [pane-id]
#     mode:    auto (default) | scrollback | claude
#     pane-id: the pane the key was pressed in. The tmux binding passes
#              #{pane_id} (expanded against the triggering pane). Passing it
#              explicitly matters: without it nvim would fall back to the
#              ACTIVE pane, which is wrong when triggered from an inactive split.
#
# All detection and capture happen inside nvim (see lua/zach/pane-viewer/). This
# script only opens the popup and hands nvim the pane id + mode via env vars —
# no temp files, no JSON marshalling, no python.

set -euo pipefail

MODE="${1:-auto}"
PANE_ID="${2:-$(tmux display-message -p '#{pane_id}')}"
PANE_CWD="$(tmux display-message -p -t "$PANE_ID" '#{pane_current_path}')"

# Fire the User event so lazy.nvim loads the plugin, then launch the viewer.
# `-B` removes the popup border and 100%x100% fills the pane, matching Kitty's
# scrollback overlay: it covers everything and, on quit, returns to the pane
# underneath (e.g. Claude) exactly as it was.
tmux popup -E -B -w 100% -h 100% -d "$PANE_CWD" \
    -e "ZACH_PV_MODE=$MODE" \
    -e "ZACH_PV_PANE=$PANE_ID" \
    "nvim -c \"lua vim.api.nvim_exec_autocmds('User', { pattern = 'PaneViewerLaunch', modeline = false }); require('zach.pane-viewer').launch()\""
