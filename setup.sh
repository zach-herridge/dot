#!/bin/bash
set -e  # Exit on any error

echo "Starting dotfiles installation..."

if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

eval "$(/opt/homebrew/bin/brew shellenv)"

brew install stow

if [ ! -d ~/dot ]; then
    echo "Cloning dotfiles repo..."
    git clone https://github.com/zach-herridge/dot ~/dot
fi

mkdir -p ~/dot/zsh

stow .

echo "Installing tools via Homebrew..."
brew install git zoxide fd wget tmux dua-cli btop lazygit fzf fzf-tab ripgrep starship eza bat atuin ghostty kitty zsh-autosuggestions zsh-syntax-highlighting astroterm imagemagick
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

stow .

echo "Setting up Kiro configuration..."
stow --target=$HOME kiro

echo "Creating shell configuration symlinks..."
ln -sf ~/dot/zsh/zshrc ~/.zshrc
ln -sf ~/dot/tmux/tmux.conf ~/.tmux.conf

echo "Install complete!"
