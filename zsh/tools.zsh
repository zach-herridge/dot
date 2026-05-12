# Activate Homebrew (detect platform automatically)
if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
elif [[ -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
    eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

# Cache brew prefix for use by other zsh config files
if command -v brew &>/dev/null; then
    export BREW_PREFIX="$(brew --prefix)"
else
    export BREW_PREFIX=""
fi
