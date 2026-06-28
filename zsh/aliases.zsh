alias v="nvim"
alias bb="brazil-build"
alias bbb="brazil-recursive-cmd -allPackages brazil-build release"
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

# Reload the shell config, and the tmux config too if we're inside tmux — so a
# single `reload` refreshes the whole environment. tmux never re-reads its
# config on its own, so without this an edited tmux.conf keeps serving stale
# settings until the next `prefix+r` / restart.
# `unalias` guard: this file was previously sourced when `reload` was an alias,
# and re-sourcing over an existing alias makes zsh reject the function def.
unalias reload 2>/dev/null
reload() {
  source ~/dot/zsh/zshrc
  if [ -n "$TMUX" ]; then
    tmux source-file ~/.config/tmux/tmux.conf && echo "reloaded zsh + tmux"
  else
    echo "reloaded zsh"
  fi
}

alias arcc-local="$HOME/workplace/ArccApp/src/ARCCCliCore/build/arcc-cli/arcc"
