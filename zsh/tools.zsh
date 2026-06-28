# Homebrew itself is already activated in ~/.zshenv (sourced by every shell, so
# brew binaries resolve in non-interactive `ssh host "..."` commands too). Here
# we only derive BREW_PREFIX for the interactive config files that need it
# (completions, modern-zsh). brew shellenv exports HOMEBREW_PREFIX, so reuse it
# instead of spawning another `brew --prefix` subprocess.
if [[ -n $HOMEBREW_PREFIX ]]; then
    export BREW_PREFIX="$HOMEBREW_PREFIX"
elif command -v brew &>/dev/null; then
    export BREW_PREFIX="$(brew --prefix)"
else
    export BREW_PREFIX=""
fi
