#!/bin/bash
set -e

# Mirror of setup.sh's install steps, in reverse. The stow-package list comes
# from the shared manifest (lib/packages.sh) so this can't drift from setup.sh.

source ~/dot/lib/packages.sh

echo "Starting dotfiles uninstallation..."

# --- Unstow the same packages setup.sh stowed ---
echo "Unstowing config packages..."
STOW_PKGS=(); while IFS= read -r p; do STOW_PKGS+=("$p"); done < <(dot_stow_pkgs)
cd ~/dot && stow -D "${STOW_PKGS[@]}" 2>/dev/null || true

# --- Remove the shell symlinks setup.sh created ---
echo "Removing shell configuration symlinks..."
rm -f ~/.zshrc ~/.zshenv

# --- Remove tmux plugins (now pinned under ~/.config/tmux/plugins) ---
echo "Removing tmux plugins..."
rm -rf ~/.config/tmux/plugins ~/.tmux/plugins

echo "Uninstall complete (Homebrew packages left installed — remove manually if desired)."
