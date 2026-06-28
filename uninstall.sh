#!/bin/bash
set -e

# Mirror of setup.sh's install steps, in reverse. Keep the STOW_PKGS list and the
# shell-symlink set IN SYNC with setup.sh — if they drift, teardown silently
# leaves files behind (the previous version unstowed a package named "." that
# matched nothing, and removed a ~/.tmux.conf that setup never creates).

OS="$(uname -s)"

echo "Starting dotfiles uninstallation..."

# --- Unstow the same packages setup.sh stowed ---
echo "Unstowing config packages..."
STOW_PKGS=(atuin btop mise nvim ripgrep starship tmux)
if [[ "$OS" == "Darwin" ]]; then
    STOW_PKGS+=(kitty)
fi
cd ~/dot && stow -D "${STOW_PKGS[@]}" 2>/dev/null || true

# --- Remove the shell symlinks setup.sh created ---
echo "Removing shell configuration symlinks..."
rm -f ~/.zshrc ~/.zshenv

# --- Remove tmux plugins (now pinned under ~/.config/tmux/plugins) ---
echo "Removing tmux plugins..."
rm -rf ~/.config/tmux/plugins ~/.tmux/plugins

echo "Uninstall complete (Homebrew packages left installed — remove manually if desired)."
