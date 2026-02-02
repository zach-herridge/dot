function inrepos() {
    local depth="${INREPOS_DEPTH:-3}"
    find . -maxdepth "$depth" -name ".git" -type d | while read gitdir; do
        repo=$(dirname "$gitdir")
        echo -e "\n=== $repo ==="
        (cd "$repo" && eval "$@")
    done
}



clc() {
    fc -ln -2 -2 | pbcopy
    echo "Last command copied to clipboard"
}

# Tmux scrollback to nvim (no history)
tmux-scrollback() {
    nvim =(tmux capture-pane -pS -)
}
# Edit tmux scrollback in nvim
scrollback() {
    nvim -c 'normal! G' =(tmux capture-pane -pS -)
}

# Smart kitty tab title based on workplace projects
_kitty_smart_tab_title() {
    [[ -z "$KITTY_WINDOW_ID" ]] && return
    
    local tab_title
    
    # Fast path: current window is in a project subdirectory (not root)
    if [[ "$PWD" =~ .*/workplace/([^/]+)/.+ ]]; then
        tab_title="${match[1]}"
    else
        # Check other windows for project subdirectories
        local json=$(kitty @ ls 2>/dev/null)
        [[ -n "$json" ]] && tab_title=$(echo "$json" | jq -r --arg wid "$KITTY_WINDOW_ID" '
            .[] | .tabs[] | select(.windows[] | .id == ($wid | tonumber)) |
            .windows[].cwd | select(test(".*/workplace/[^/]+/.+")) |
            capture(".*/workplace/(?<proj>[^/]+)") | .proj
        ' 2>/dev/null | head -1)
        
        # Fallback: current directory name
        [[ -z "$tab_title" ]] && tab_title="${PWD##*/}"
    fi
    
    kitty @ set-tab-title "$tab_title" 2>/dev/null
}

autoload -Uz add-zsh-hook
add-zsh-hook chpwd _kitty_smart_tab_title
_kitty_smart_tab_title  # Run once on shell start



