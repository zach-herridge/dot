#!/usr/bin/env bash
# scrollback-nvim.sh — Launch nvim in a tmux popup to view scrollback or Claude conversation.
#
# Usage:
#   scrollback-nvim.sh scrollback [pane-id]  — always show scrollback
#   scrollback-nvim.sh claude     [pane-id]  — always show claude conversation
#   scrollback-nvim.sh auto       [pane-id]  — claude running: conversation; else scrollback
#
# pane-id: the tmux pane the key was pressed in. The binding passes #{pane_id}
# (expanded against the triggering pane). Without it we'd fall back to
# `display-message`, which resolves to the active pane of the active window —
# WRONG when triggered from an inactive split, so Claude detection and capture
# would target the wrong pane.

MODE="${1:-auto}"
# Prefer the pane id passed by the binding; fall back to the active pane.
PANE_ID="${2:-$(tmux display-message -p '#{pane_id}')}"
PANE_PID="$(tmux display-message -p -t "$PANE_ID" '#{pane_pid}')"
PANE_CWD="$(tmux display-message -p -t "$PANE_ID" '#{pane_current_path}')"

# ─── Helper: newest file matching a glob in a directory ──────────────────────
# Returns the most-recently-modified match, or empty string if there are none.
# NOTE: do NOT use `find ... | xargs ls -t` here — when find matches nothing,
# xargs still runs a bare `ls -t`, which lists $PWD and returns an unrelated
# filename (e.g. "dot"). That bogus path then gets fed to nvim's readfile(),
# producing "E484: Can't open file dot". Use find's own -printf sort instead.
newest_match() {
    local dir="$1" glob="$2"
    [[ -d "$dir" ]] || { echo ""; return; }
    find "$dir" -type f -name "$glob" -printf '%T@\t%p\n' 2>/dev/null \
        | sort -rn \
        | head -1 \
        | cut -f2-
}

# ─── Helper: find claude PID by walking the pane's process tree ──────────────
get_claude_pid() {
    # Walk the full process tree under PANE_PID looking for claude/node+claude
    local pids
    pids=$(pgrep -a "claude" 2>/dev/null | grep -v "grep" | awk '{print $1}') || true

    if [[ -z "$pids" ]]; then
        echo ""
        return
    fi

    # Check if any of these claude processes are descendants of our pane
    local pid
    for pid in $pids; do
        local current="$pid"
        local i
        for i in $(seq 1 15); do
            local parent
            parent=$(ps -o ppid= -p "$current" 2>/dev/null | tr -d ' ') || true
            [[ -z "$parent" || "$parent" == "0" || "$parent" == "1" ]] && break
            if [[ "$parent" == "$PANE_PID" ]]; then
                echo "$pid"
                return
            fi
            current="$parent"
        done
    done

    echo ""
}

# ─── Helper: find Claude conversation JSONL ───────────────────────────────────
# Mirrors the 4-strategy lookup from the original Kitty Python kitten
find_claude_conversation() {
    local claude_pid="$1"
    local cwd="$2"
    local sessions_dir="$HOME/.claude/sessions"

    # Strategy 1: PID -> session file
    if [[ -n "$claude_pid" && -f "$sessions_dir/$claude_pid.json" ]]; then
        local conv
        conv=$(resolve_session_file "$sessions_dir/$claude_pid.json" "$cwd")
        if [[ -n "$conv" ]]; then
            echo "$conv"
            return
        fi
    fi

    # Strategy 2: Walk process tree upward looking for session files
    if [[ -n "$claude_pid" ]]; then
        local current="$claude_pid"
        local i
        for i in $(seq 1 10); do
            local parent
            parent=$(ps -o ppid= -p "$current" 2>/dev/null | tr -d ' ') || true
            [[ -z "$parent" || "$parent" == "0" || "$parent" == "1" || "$parent" == "$current" ]] && break
            if [[ -f "$sessions_dir/$parent.json" ]]; then
                local conv
                conv=$(resolve_session_file "$sessions_dir/$parent.json" "$cwd")
                if [[ -n "$conv" ]]; then
                    echo "$conv"
                    return
                fi
            fi
            current="$parent"
        done
    fi

    # Strategy 3: Most recent JSONL in CWD-scoped project directory
    if [[ -n "$cwd" ]]; then
        local encoded="${cwd//\//-}"
        local project_dir="$HOME/.claude/projects/$encoded"
        if [[ -d "$project_dir" ]]; then
            local newest
            newest=$(newest_match "$project_dir" "*.jsonl")
            if [[ -n "$newest" ]]; then
                echo "$newest"
                return
            fi
        fi
    fi

    # Strategy 4: Global fallback - most recent session
    if [[ -d "$sessions_dir" ]]; then
        local newest_session
        newest_session=$(newest_match "$sessions_dir" "*.json")
        if [[ -n "$newest_session" ]]; then
            local conv
            conv=$(resolve_session_file "$newest_session" "$cwd")
            if [[ -n "$conv" ]]; then
                echo "$conv"
                return
            fi
        fi
    fi

    echo ""
}

# ─── Helper: resolve a session JSON file to its conversation JSONL ────────────
resolve_session_file() {
    local session_file="$1"
    local fallback_cwd="$2"

    # Use python3 with sys.argv to avoid shell injection issues
    local session_id cwd_from_session
    session_id=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('sessionId',''))" "$session_file" 2>/dev/null) || true
    cwd_from_session=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('cwd',''))" "$session_file" 2>/dev/null) || true

    if [[ -z "$session_id" ]]; then
        echo ""
        return
    fi

    local try_cwd encoded conv_file
    for try_cwd in "$cwd_from_session" "$fallback_cwd"; do
        [[ -z "$try_cwd" ]] && continue
        encoded="${try_cwd//\//-}"
        conv_file="$HOME/.claude/projects/$encoded/$session_id.jsonl"
        if [[ -f "$conv_file" ]]; then
            echo "$conv_file"
            return
        fi
    done

    echo ""
}

# ─── Auto mode logic ─────────────────────────────────────────────────────────
conv_file=""

if [[ "$MODE" == "auto" ]]; then
    claude_pid=$(get_claude_pid)
    if [[ -n "$claude_pid" ]]; then
        conv_file=$(find_claude_conversation "$claude_pid" "$PANE_CWD")
        if [[ -n "$conv_file" ]]; then
            MODE="claude"
        else
            MODE="scrollback"
        fi
    else
        MODE="scrollback"
    fi
fi

# ─── Prepare data and launch nvim in popup ────────────────────────────────────
DATA_FILE=$(mktemp /tmp/tmux-ksb-XXXXXX.json)
BOOT_FILE=$(mktemp /tmp/tmux-ksb-boot-XXXXXX.lua)
SCROLLBACK_FILE=""

# Cleanup on any exit path (defense against nvim failures / popup kills)
cleanup() {
    # Only remove files that weren't already consumed by nvim
    [[ -f "$DATA_FILE" ]] && rm -f "$DATA_FILE"
    [[ -f "$BOOT_FILE" ]] && rm -f "$BOOT_FILE"
    [[ -n "$SCROLLBACK_FILE" && -f "$SCROLLBACK_FILE" ]] && rm -f "$SCROLLBACK_FILE"
}
trap cleanup EXIT

if [[ "$MODE" == "claude" ]]; then
    # Claude mode: find conversation file if not already found
    if [[ -z "$conv_file" ]]; then
        claude_pid=$(get_claude_pid)
        conv_file=$(find_claude_conversation "${claude_pid:-}" "$PANE_CWD")
    fi

    if [[ -z "$conv_file" ]]; then
        tmux display-message "No Claude conversation found"
        exit 0
    fi

    # Construct JSON safely using python3
    python3 -c "
import json, sys
print(json.dumps({
    'mode': 'claude',
    'conversation_file': sys.argv[1],
    'source': 'tmux'
}))
" "$conv_file" > "$DATA_FILE"
else
    # Scrollback mode: capture pane content with ANSI escape codes
    SCROLLBACK_FILE=$(mktemp /tmp/tmux-ksb-content-XXXXXX)
    tmux capture-pane -t "$PANE_ID" -p -e -S -10000 > "$SCROLLBACK_FILE"

    python3 -c "
import json, sys
print(json.dumps({
    'mode': 'scrollback',
    'scrollback_file': sys.argv[1],
    'source': 'tmux'
}))
" "$SCROLLBACK_FILE" > "$DATA_FILE"
fi

# Write lua bootstrap file (avoids all shell quoting issues)
cat > "$BOOT_FILE" <<LUAEOF
vim.api.nvim_create_autocmd('VimEnter', {
  group = vim.api.nvim_create_augroup('TmuxScrollbackEnter', { clear = true }),
  once = true,
  callback = function()
    -- Fire the event so lazy.nvim loads the plugin and runs setup()
    vim.api.nvim_exec_autocmds('User', { pattern = 'KittyScrollbackLaunch', modeline = false })

    local data_path = [==[${DATA_FILE}]==]
    local f = io.open(data_path, 'r')
    if f then
      local s = f:read('*a')
      f:close()
      os.remove(data_path)
      require('zach.kitty-scrollback').launch(s)
    end
  end,
})
LUAEOF

# Launch nvim in a tmux popup (90% size, mimics Kitty overlay)
tmux popup -E -w 90% -h 90% -d "$PANE_CWD" \
    "nvim --cmd 'luafile $BOOT_FILE'"
