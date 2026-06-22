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
    git clone git@github.com:zach-herridge/dot.git ~/dot
fi

# --- Remove legacy asdf if present ---
if [ -d "$HOME/.asdf" ]; then
    echo "Removing legacy asdf installation..."
    rm -rf "$HOME/.asdf"
    rm -f "$HOME/.tool-versions"
fi

# Stow config packages (creates ~/.config/<name>/ symlinks)
# --adopt: pull any existing files into the package, then git restores ours
echo "Stowing config packages..."
cd ~/dot

STOW_PKGS=(atuin btop mise nvim ripgrep starship tmux)
if [[ "$OS" == "Darwin" ]]; then
    STOW_PKGS+=(kitty)
fi

stow --adopt "${STOW_PKGS[@]}"
# Restore repo versions (only for tracked files — new packages skip gracefully)
for pkg in "${STOW_PKGS[@]}"; do
    git checkout -- "$pkg" 2>/dev/null || true
done

# --- Install tools (cross-platform) ---
echo "Installing tools via Homebrew..."
COMMON_PKGS=(
    git zoxide fd wget tmux dua-cli btop lazygit
    fzf fzf-tab ripgrep starship eza bat atuin
    zsh-autosuggestions zsh-syntax-highlighting
    imagemagick mise oven-sh/bun/bun
)

# macOS-only GUI apps + Nerd Font (provides the icon glyphs kitty's symbol_map
# falls back to — without it the tmux/starship statusline shows "_ _" tofu).
MACOS_PKGS=(ghostty kitty astroterm font-symbols-only-nerd-font)

brew install "${COMMON_PKGS[@]}"

if [[ "$OS" == "Darwin" ]]; then
    brew install "${MACOS_PKGS[@]}"
fi

brew install --HEAD neovim

# --- Set up mise runtimes (Node LTS, etc.) ---
echo "Installing runtimes via mise..."
eval "$(mise activate bash)"

# The tracked config pins node="lts". That's fine on macOS, but old Linux dev
# boxes (e.g. Amazon Linux 2, glibc 2.26) can't run prebuilt Node 18+ — only
# Node 16. Write a machine-local, gitignored override there so `mise install`
# resolves a Node that actually runs. Also disable Node's GPG check, whose
# keyring is often broken on corp hosts.
if [[ "$OS" == "Linux" ]]; then
    GLIBC_VER="$(ldd --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+$')"
    # Node 18+ needs glibc >= 2.28; pin to 16 below that.
    if [[ -n "$GLIBC_VER" ]] && awk "BEGIN{exit !($GLIBC_VER < 2.28)}"; then
        echo "  glibc $GLIBC_VER is < 2.28 — pinning node=16 for this host"
        mkdir -p ~/.config/mise
        printf '[tools]\nnode = "16"\n' > ~/.config/mise/config.local.toml
        export MISE_NODE_GPG_VERIFY=false
    fi
fi

mise install

echo "Configuring git..."
git config --global push.autoSetupRemote true

echo "Importing shell history into atuin..."
atuin import auto 2>/dev/null || true

if [ ! -d ~/.tmux/plugins/tpm ]; then
    echo "Installing tmux plugin manager..."
    git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
fi

# Actually install the plugins TPM manages (@plugin lines in tmux.conf).
# Without this, vim-tmux-navigator / tmux-yank are declared but never cloned.
# Must match TMUX_PLUGIN_MANAGER_PATH pinned in tmux.conf.
echo "Installing tmux plugins via TPM..."
TMUX_PLUGIN_MANAGER_PATH="$HOME/.config/tmux/plugins/" \
    ~/.tmux/plugins/tpm/bin/install_plugins 2>/dev/null || true

if [ ! -d ~/.config/tmux/plugins/catppuccin ]; then
    echo "Installing catppuccin tmux theme..."
    mkdir -p ~/.config/tmux/plugins/catppuccin
    git clone -b v2.1.3 https://github.com/catppuccin/tmux.git ~/.config/tmux/plugins/catppuccin/tmux
fi

# --- Build zh CLI tool ---
if [[ -d ~/dot/zh ]]; then
    echo "Building zh CLI..."
    (cd ~/dot/zh && bun install --frozen-lockfile)
fi

echo "Creating shell configuration symlinks..."
ln -sf ~/dot/zsh/zshrc ~/.zshrc
# .zshenv is read by ALL zsh invocations (incl. non-interactive `ssh host "tmux ..."`),
# so brew lands on PATH and tmux resolves to the modern brew build, not system tmux.
ln -sf ~/dot/zsh/zshenv ~/.zshenv

echo ""
echo "Install complete!"
echo "  Node: $(node --version)"
echo "  npm:  $(npm --version)"
echo ""
echo "Restart your shell or run: source ~/.zshrc"
