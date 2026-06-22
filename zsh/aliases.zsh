alias v="nvim"
alias bb="brazil-build"
alias bbb="brazil-recursive-cmd brazil-build release --allpackages"
alias gt="lazygit"
alias ci="zi"
alias c="clear"

alias l="eza -l --icons --git -a"
alias lt="eza --tree --level=2 --long --icons --git -a"
alias ltree="eza --tree --level=2  --icons --git"

alias k="claude --agent zach-default"

# Local tmux: attach or create "main" session.
# -u forces UTF-8 mode so Nerd Font glyphs render even if the launching shell's
# locale is not UTF-8 (belt-and-suspenders with the LANG export in ~/.zshenv).
alias t="tmux -u new-session -A -s main"

# SSH with auto-attach to persistent tmux session on the remote
s() { ssh -t "$@" "tmux -u new-session -A -s main"; }

alias view_disk="dua i"
alias view_cpu="btop"

alias reload="source ~/dot/zsh/zshrc"

alias arcc-local="$HOME/workplace/ArccApp/src/ARCCCliCore/build/arcc-cli/arcc"
