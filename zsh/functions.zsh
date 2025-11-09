function inrepos() {
    find . -maxdepth 4 -name ".git" -type d | while read gitdir; do
        repo=$(dirname "$gitdir")
        echo -e "\n=== $repo ==="
        (cd "$repo" && "$@")
    done
}

function ws_clean() {
    local current_dir="$PWD"
    local workplace_dir="/Users/zachhe/workplace"
    
    if [[ "$current_dir" == "$workplace_dir"/* ]]; then
        local project_dir=$(echo "$current_dir" | sed "s|$workplace_dir/||" | cut -d'/' -f1)
        local target_dir="$workplace_dir/$project_dir"
        
        echo "Running clean from: $target_dir"
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
