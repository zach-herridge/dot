#!/bin/bash
set -e

echo "Starting dotfiles uninstallation..."

echo "Removing symlinks..."
rm -f ~/.zshrc ~/.tmux.conf

echo "Unstowing dotfiles..."
cd ~/dot && stow -D .

echo "Removing tmux plugins..."
rm -rf ~/.tmux/plugins

echo "Uninstalling Homebrew packages..."
brew uninstall --ignore-dependencies git zoxide fd wget tmux lazygit fzf ripgrep starship eza ghostty zsh-autosuggestions zsh-syntax-highlighting neovim stow 2>/dev/null || true

echo "Uninstall complete!"