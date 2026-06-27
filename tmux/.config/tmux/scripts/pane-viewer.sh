#!/usr/bin/env bash
# pane-viewer.sh — Open the scrollback / Claude-conversation viewer for a tmux
# pane in an nvim popup sized and positioned to overlay just that pane.
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

# Pull the pane's cwd and geometry. Width/height must be pre-expanded here:
# tmux rejects format strings ("#{pane_height}") in the popup -w/-h flags
# ("height invalid"), so we resolve them in the shell. cwd is read via plain
# quoted command substitution (not eval) so a path containing spaces is safe.
PANE_CWD="$(tmux display-message -p -t "$PANE_ID" '#{pane_current_path}')"
PANE_W="$(tmux display-message -p -t "$PANE_ID" '#{pane_width}')"
PANE_H="$(tmux display-message -p -t "$PANE_ID" '#{pane_height}')"

# Fire the User event so lazy.nvim loads the plugin, then launch the viewer.
# Overlay the popup on just the referenced pane (not the whole client):
#   -t            target the pane, so the position keyword resolves against it
#   -x P -y P     P = bottom-left of that pane; tmux computes the real screen
#                 position itself, correctly accounting for the status bar and
#                 split layout (no manual coordinate math, works for any pane)
#   -w/-h         match the pane's size; -B drops the border so it fills exactly
# On quit the popup vanishes and the pane underneath (e.g. Claude) is unchanged.
tmux popup -E -B -t "$PANE_ID" -x P -y P -w "$PANE_W" -h "$PANE_H" -d "$PANE_CWD" \
    -e "ZACH_PV_MODE=$MODE" \
    -e "ZACH_PV_PANE=$PANE_ID" \
    "nvim -c \"lua vim.api.nvim_exec_autocmds('User', { pattern = 'PaneViewerLaunch', modeline = false }); require('zach.pane-viewer').launch()\""
