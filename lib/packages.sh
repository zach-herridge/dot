#!/usr/bin/env bash
# packages.sh — single source of truth for what this dotfiles repo installs and
# stows. Sourced by setup.sh, uninstall.sh, and `bin/dot doctor` so the three
# can never drift apart. Pure data + a couple of helpers; no side effects.

# Stow packages (each is a top-level dir whose contents are symlinked into
# $HOME). Linux gets the cross-platform set; macOS adds GUI-terminal config.
DOT_STOW_PKGS=(atuin btop mise nvim ripgrep starship tmux)
DOT_STOW_PKGS_DARWIN=(kitty)

# Homebrew formulae installed on every platform.
DOT_BREW_COMMON=(
    git zoxide fd wget tmux dua-cli btop lazygit
    fzf fzf-tab ripgrep starship eza bat atuin
    zsh-autosuggestions zsh-syntax-highlighting
    imagemagick mise oven-sh/bun/bun neovim
)

# macOS-only: GUI terminals + the Nerd Font that backs kitty's symbol_map (so
# the tmux/starship statusline glyphs don't render as "_" tofu).
DOT_BREW_DARWIN=(ghostty kitty astroterm font-symbols-only-nerd-font)

# Binaries that should resolve once the install is complete. Used by
# `dot doctor` to sanity-check the environment. (Format: "binary".)
DOT_REQUIRED_BINS=(
    brew git stow zsh tmux nvim
    zoxide fd fzf rg starship eza bat atuin mise bun node
)

# Resolve the full stow-package list for the current platform.
dot_stow_pkgs() {
    local pkgs=("${DOT_STOW_PKGS[@]}")
    if [[ "$(uname -s)" == "Darwin" ]]; then
        pkgs+=("${DOT_STOW_PKGS_DARWIN[@]}")
    fi
    printf '%s\n' "${pkgs[@]}"
}

# Resolve the full brew-formula list for the current platform.
dot_brew_pkgs() {
    local pkgs=("${DOT_BREW_COMMON[@]}")
    if [[ "$(uname -s)" == "Darwin" ]]; then
        pkgs+=("${DOT_BREW_DARWIN[@]}")
    fi
    printf '%s\n' "${pkgs[@]}"
}
