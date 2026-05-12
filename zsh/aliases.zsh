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

# Kitty-specific aliases (only when kitty is available)
if command -v kitten &>/dev/null; then
    alias s="kitten ssh"
    alias clip="kitten clipboard"
fi

alias view_disk="dua i"
alias view_cpu="btop"

alias reload="source ~/dot/zsh/zshrc"

alias arcc-local="$HOME/workplace/ArccApp/src/ARCCCliCore/build/arcc-cli/arcc"
