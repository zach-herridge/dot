#!/bin/bash
set -e  # Exit on any error

echo "Starting dotfiles installation..."

# --- Detect platform ---
OS="$(uname -s)"
ARCH="$(uname -m)"

# --- Install Homebrew if missing ---
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# --- Activate Homebrew (path depends on platform) ---
if [[ "$OS" == "Darwin" ]]; then
    if [[ "$ARCH" == "arm64" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        eval "$(/usr/local/bin/brew shellenv)"
    fi
elif [[ "$OS" == "Linux" ]]; then
    eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

brew install stow

if [ ! -d ~/dot ]; then
    echo "Cloning dotfiles repo..."
    git clone https://github.com/zach-herridge/dot ~/dot
fi

mkdir -p ~/dot/zsh

cd ~/dot
stow .

# --- Install tools (cross-platform) ---
echo "Installing tools via Homebrew..."
COMMON_PKGS=(
    git zoxide fd wget tmux dua-cli btop lazygit
    fzf fzf-tab ripgrep starship eza bat atuin
    zsh-autosuggestions zsh-syntax-highlighting
    imagemagick
)

# macOS-only GUI apps
MACOS_PKGS=(ghostty kitty astroterm)

brew install "${COMMON_PKGS[@]}"

if [[ "$OS" == "Darwin" ]]; then
    brew install "${MACOS_PKGS[@]}"
fi

brew install --HEAD neovim

echo "Configuring git..."
git config --global push.autoSetupRemote true

echo "Importing shell history into atuin..."
atuin import auto 2>/dev/null || true

if [ ! -d ~/.tmux/plugins/tpm ]; then
    echo "Installing tmux plugin manager..."
    git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
fi

if [ ! -d ~/.config/tmux/plugins/catppuccin ]; then
    echo "Installing catppuccin tmux theme..."
    mkdir -p ~/.config/tmux/plugins/catppuccin
    git clone -b v2.1.3 https://github.com/catppuccin/tmux.git ~/.config/tmux/plugins/catppuccin/tmux
fi

cd ~/dot
stow .

echo "Setting up Kiro configuration..."
stow --target=$HOME kiro

echo "Creating shell configuration symlinks..."
ln -sf ~/dot/zsh/zshrc ~/.zshrc
ln -sf ~/dot/tmux/tmux.conf ~/.tmux.conf

echo "Install complete!"
