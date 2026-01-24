function inrepos() {
    local depth="${INREPOS_DEPTH:-3}"
    find . -maxdepth "$depth" -name ".git" -type d | while read gitdir; do
        repo=$(dirname "$gitdir")
        echo -e "\n=== $repo ==="
        (cd "$repo" && eval "$@")
    done
}

function ws_clean() {
    local current_dir="$PWD"
    local workplace_dir="/Users/zachhe/workplace"
    
    if [[ "$current_dir" == "$workplace_dir"/* ]]; then
        local project_dir=$(echo "$current_dir" | sed "s|$workplace_dir/||" | cut -d'/' -f1)
        local target_dir="$workplace_dir/$project_dir"
        
        echo "Running clean from: $target_dir"
        (cd "$target_dir" && rm -rf node_modules build dist env)
        (cd "$target_dir" && find . -maxdepth 4 -name ".git" -type d | while read gitdir; do
            repo=$(dirname "$gitdir")
            echo -e "\n=== $target_dir/$repo ==="
            (cd "$repo" && rm -rf node_modules build dist env)
        done)
    else
        echo "Not in workplace directory, running from current location"
        inrepos rm -rf node_modules build dist && rm -rf build env
    fi
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

# Unified branch view across multi-repo workspace (sorted by most recent activity)
ws_branches() {
    local dir="${1:-$(pwd)}"
    find "$dir" -maxdepth 1 -type d -exec test -d {}/.git \; -print 2>/dev/null | while read r; do
        git -C "$r" for-each-ref --format='%(committerdate:iso)|%(refname:short)' refs/heads 2>/dev/null
    done | sort -t'|' -k2,2 -k1,1r | awk -F'|' '!seen[$2]++ {print $1"|"$2}' | sort -r
}

# Rebase branch onto mainline across all repos
rebase_mainline() {
    local branch="${1:-uat_v5}"
    inrepos git checkout mainline
    inrepos git pull
    inrepos git checkout "$branch"
    inrepos git rebase mainline
}
