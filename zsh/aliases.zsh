alias v="nvim"
alias bb="brazil-build"
alias bbb="brazil-recursive-cmd brazil-build release --allPackages"
alias bbk="bb ktlintFormat; bb"
alias gt="lazygit"
alias ci="zi"
alias c="clear"
alias btest="bb && bb format & bb lint-fix"

alias l="eza -l --icons --git -a"
alias lt="eza --tree --level=2 --long --icons --git -a"
alias ltree="eza --tree --level=2  --icons --git"

alias q="kiro-cli"

alias view_disk="dua i"
alias view_cpu="btop"

alias reload="source ~/dot/zsh/zshrc && tmux source-file ~/.tmux.conf"
