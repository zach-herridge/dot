function inrepos() {
    local depth="${INREPOS_DEPTH:-3}"
    find . -maxdepth "$depth" -name ".git" -type d 2>/dev/null | while IFS= read -r gitdir; do
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
    # pbcopy works cross-platform — real binary on macOS, shim on Linux
    # (see zsh/clipboard.zsh).
    local cmd
    cmd="$(fc -ln -2 -2)"
    echo -n "$cmd" | pbcopy && echo "Last command copied to clipboard"
}

# File transfer over kitten ssh (run these ON THE REMOTE)
# send: push remote file(s) to local ~/Downloads
# recv: pull local file to remote cwd
send() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: send <file>... [local_dest]"
        echo "  send report.txt           → ~/Downloads/report.txt"
        echo "  send *.log ~/Desktop/     → ~/Desktop/*.log"
        return 1
    fi
    if [[ $# -eq 1 ]]; then
        kitten transfer "$1" ~/Downloads/
    else
        kitten transfer "$@"
    fi
}

recv() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: recv <local_path> [remote_dest]"
        echo "  recv ~/Desktop/key.pem    → ./key.pem"
        echo "  recv ~/Desktop/key.pem /tmp/"
        return 1
    fi
    kitten transfer --direction=receive "$@"
}

# Open the full tmux scrollback in nvim. `command nvim` bypasses the nvim()
# wrapper above (we don't want its /tmp/nvim_cd_target cd side-effect here).
# Pass -t to start at the top, or default to the bottom (latest output).
scrollback() {
    if [[ "$1" == "-t" ]]; then
        command nvim =(tmux capture-pane -pS -)
    else
        command nvim -c 'normal! G' =(tmux capture-pane -pS -)
    fi
}
alias tmux-scrollback='scrollback -t'





