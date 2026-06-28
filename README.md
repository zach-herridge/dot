# Dotfiles

My curated development environment featuring modern CLI tools and optimized
terminal workflows. Built for productivity with Neovim, tmux, and an enhanced
shell. Works on macOS and Linux (including Amazon dev boxes).

## Setup

```bash
git clone https://github.com/zach-herridge/dot ~/dot
cd ~/dot
./setup.sh
```

`setup.sh` is cross-platform: it detects macOS (Apple Silicon / Intel) or Linux
(linuxbrew), installs tools via Homebrew, stows the config packages, links the
shell files, and installs tmux/Neovim plugins. On older Linux hosts it pins a
glibc-compatible Node via `mise`. The stow-package and brew-formula lists live
in one manifest (`lib/packages.sh`) shared by `setup.sh`, `uninstall.sh`, and
`dot doctor`, so they can't drift.

After setup (or any time something feels off), run **`dot doctor`** for a
health check: required binaries, config symlinks pointing into `~/dot`, tmux
being the brew build (not stale system tmux), a UTF-8 locale, and tmux plugins
present. It codifies the fixes documented in
`docs/remote-terminal-troubleshooting.md`.

### Shell (Zsh)
- **Starship prompt** - Fast, customizable prompt with git integration
- **atuin** - SQLite-backed shell history with a fuzzy TUI (`Ctrl+R`)
- **zoxide** - Smart `cd` that learns your most-used directories
- **fzf-tab** - Fuzzy tab completion with previews
- **Autosuggestions + syntax highlighting** - Loaded in the correct order
- **Modular config** - One concern per file, sourced from `zsh/zshrc`

### Terminal Multiplexer (tmux)
- **Custom key bindings** - `Ctrl+A` prefix with kitty-style split commands
- **Plugin management** - TPM with the Catppuccin theme
- **Vim navigation** - Seamless pane switching with vim-tmux-navigator
- **Pane viewer** - `Ctrl+A v` / `Ctrl+U` opens scrollback or the running Claude
  conversation in an nvim popup overlaying just that pane
- **Hints** - `Ctrl+A f/g/u/y` to fuzzy-pick a path / git hash / URL / line
- **OSC 52 clipboard** - Copy works locally and over SSH

### Editor (Neovim)
- **lazy.nvim** - Modern plugin manager with lazy-loading
- **Modular Lua config** - Under `nvim/.config/nvim/lua/zach`
- **Custom plugins** - A multi-repo git status panel, the tmux pane viewer, and
  a dashboard that renders a live star map (`skyview`)

### Terminal (kitty)
- **Catppuccin theme** - Consistent color scheme across tools
- **kitten ssh / transfer** - `send` / `recv` helpers for remote file transfer
- macOS-only (Linux hosts are used over SSH from a local kitty)

### `zh` - Brazil workspace CLI
A custom Bun/TypeScript CLI for Amazon Brazil workspaces (`zh/`). Highlights:
`zh status` across all repos, `zh build` with a real dependency graph,
`zh prep` (squash + rebase + Claude-generated commit messages), `zh deploy`,
`zh cr`, and `zh prune`. Sourced into the shell via `zh/shell/zh.zsh`.

## Tools Installed

| Tool | Purpose | Alias |
|------|---------|-------|
| `eza` | Better `ls` | `l`, `lt`, `ltree` |
| `zoxide` | Smart `cd` | `ci` |
| `atuin` | Shell history TUI | `Ctrl+R` |
| `ripgrep` | Fast grep | - |
| `fd` | Better find | - |
| `fzf` | Fuzzy finder | - |
| `bat` | Better `cat` | - |
| `lazygit` | Git TUI | `gt` |
| `dua-cli` | Disk usage | `view_disk` |
| `btop` | System monitor | `view_cpu` |
| `mise` | Runtime version manager | - |

## Key Features

### Aliases
- `v` - Open Neovim
- `gt` - Launch lazygit
- `t` - Attach/create the `main` tmux session
- `s <host>` - SSH and auto-attach to a remote tmux session
- `reload` - Reload shell config (and tmux config when inside tmux)

### tmux Bindings
- `Ctrl+A \` or `|` - Split horizontally
- `Ctrl+A -` - Split vertically
- `Ctrl+A h/j/k/l` - Resize panes
- `Ctrl+A v` / `Ctrl+U` - Open the pane viewer (scrollback / Claude transcript)

### Directory Structure
```
~/dot/
├── setup.sh           # Cross-platform installation script
├── uninstall.sh       # Removal script (mirrors setup.sh)
├── .stowrc            # Stow configuration
├── zsh/               # Shell configuration (+ ~/.zshrc, ~/.zshenv symlinks)
├── tmux/              # tmux config + scripts (pane-viewer, hints)
├── nvim/              # Neovim configuration
├── kitty/             # Terminal emulator config (macOS)
├── starship/          # Prompt configuration
├── atuin/             # Shell history config
├── mise/              # Runtime version pins
├── ripgrep/           # ripgrep config
├── btop/              # System monitor config
└── zh/                # Brazil workspace CLI (Bun/TypeScript)
```

## Customization

All configurations are modular and can be customized by editing files in their
respective directories. After making changes, run `reload` to apply them.

## Uninstall

```bash
~/dot/uninstall.sh
```

Unstows the config packages and removes the shell symlinks. Homebrew packages
are left installed (remove manually if desired).

## Requirements

- macOS (Apple Silicon or Intel) or Linux with Homebrew/linuxbrew
- Git
- Internet connection for initial setup
