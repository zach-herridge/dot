function inrepos() {
    local depth="${INREPOS_DEPTH:-3}"
    find . -maxdepth "$depth" -name ".git" -type d | while read gitdir; do
        repo=$(dirname "$gitdir")
        echo -e "\n=== $repo ==="
        (cd "$repo" && eval "$@")
    done
}

nvim() {
    command nvim "$@"
    if [[ -f /tmp/nvim_cd_target ]]; then
        cd "$(cat /tmp/nvim_cd_target)"
        rm /tmp/nvim_cd_target
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





