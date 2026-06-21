#!/usr/bin/env bash
# hints.sh — Pick items from tmux pane content using fzf, mimicking Kitty hints.
#
# Usage (called from tmux popup binding, so fzf has a proper terminal):
#   hints.sh path   — pick a file path, open in nvim
#   hints.sh hash   — pick a git hash, copy to clipboard
#   hints.sh url    — pick a URL, open in browser
#   hints.sh line   — pick a line, copy to clipboard

HINT_TYPE="${1:-path}"

# When launched via tmux popup, we need to get the ORIGINAL pane (not the popup).
# The popup inherits environment, but we need the pane that triggered it.
# Use TMUX_PANE if set by the binding, otherwise fall back to active pane in window.
if [[ -n "${TMUX_PANE:-}" ]]; then
    PANE_ID="$TMUX_PANE"
else
    PANE_ID="$(tmux display-message -p '#{pane_id}')"
fi
PANE_CWD="$(tmux display-message -t "$PANE_ID" -p '#{pane_current_path}' 2>/dev/null)" || PANE_CWD="$HOME"

# Capture pane content (no ANSI codes for parsing)
CONTENT=$(tmux capture-pane -t "$PANE_ID" -p -S -500) || true

if [[ -z "$CONTENT" ]]; then
    echo "No content in pane"
    exit 0
fi

# ─── Clipboard helper (macOS + Linux) ────────────────────────────────────────
copy_to_clipboard() {
    if command -v pbcopy &>/dev/null; then
        pbcopy
    elif command -v wl-copy &>/dev/null; then
        wl-copy
    elif command -v xclip &>/dev/null; then
        xclip -selection clipboard
    else
        echo "(no clipboard tool found)" >&2
    fi
}

case "$HINT_TYPE" in
    path)
        # Extract file paths: require at least one / or a file extension
        # Filter out version numbers, abbreviations, and URL fragments
        MATCHES=$(echo "$CONTENT" \
            | grep -oE '(~?\.?/?[a-zA-Z0-9_@./-]+\.[a-zA-Z0-9]+|\.?/?[a-zA-Z0-9_.-]+(/[a-zA-Z0-9_@.-]+)+)' \
            | grep -vE '^\d+\.\d+(\.\d+)*$' \
            | grep -vE '^(e\.g|i\.e|etc|vs)\.' \
            | grep -vE '^https?://' \
            | awk '!seen[$0]++' \
        ) || true

        if [[ -z "$MATCHES" ]]; then
            echo "No file paths found"
            exit 0
        fi
        SELECTED=$(echo "$MATCHES" | fzf --prompt="Open file: " --layout=reverse) || true
        if [[ -n "$SELECTED" ]]; then
            # Expand ~ and resolve relative paths
            if [[ "$SELECTED" == ~* ]]; then
                SELECTED="${SELECTED/#\~/$HOME}"
            elif [[ "$SELECTED" != /* ]]; then
                SELECTED="$PANE_CWD/$SELECTED"
            fi
            # Open in the user's pane (send command to it)
            printf -v ESCAPED_PATH '%q' "$SELECTED"
            tmux send-keys -t "$PANE_ID" "nvim $ESCAPED_PATH" Enter
        fi
        ;;

    hash)
        # Extract git hashes: 7-12 chars (short) or exactly 40 (full)
        # Require mixed digits + letters to filter out color codes and pure numbers
        MATCHES=$(echo "$CONTENT" \
            | grep -oE '\b[0-9a-f]{7,12}\b|\b[0-9a-f]{40}\b' \
            | grep '[0-9]' \
            | grep '[a-f]' \
            | awk '!seen[$0]++' \
        ) || true

        if [[ -z "$MATCHES" ]]; then
            echo "No git hashes found"
            exit 0
        fi
        SELECTED=$(echo "$MATCHES" | fzf --prompt="Copy hash: " --layout=reverse) || true
        if [[ -n "$SELECTED" ]]; then
            echo -n "$SELECTED" | copy_to_clipboard
            tmux display-message "Copied: $SELECTED"
        fi
        ;;

    url)
        # Extract URLs, strip trailing punctuation
        MATCHES=$(echo "$CONTENT" \
            | grep -oE 'https?://[^[:space:]>"'"'"')\]]+' \
            | sed 's/[.,;:!?]*$//' \
            | awk '!seen[$0]++' \
        ) || true

        if [[ -z "$MATCHES" ]]; then
            echo "No URLs found"
            exit 0
        fi
        SELECTED=$(echo "$MATCHES" | fzf --prompt="Open URL: " --layout=reverse) || true
        if [[ -n "$SELECTED" ]]; then
            open "$SELECTED" 2>/dev/null || xdg-open "$SELECTED" 2>/dev/null
            tmux display-message "Opened: $SELECTED"
        fi
        ;;

    line)
        # Pick any non-empty line from the pane content (preserving order)
        SELECTED=$(echo "$CONTENT" | grep -v '^$' | fzf --prompt="Copy line: " --layout=reverse) || true
        if [[ -n "$SELECTED" ]]; then
            echo -n "$SELECTED" | copy_to_clipboard
            tmux display-message "Copied to clipboard"
        fi
        ;;

    *)
        echo "Unknown hint type: $HINT_TYPE"
        exit 1
        ;;
esac
