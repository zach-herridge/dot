# Dotfiles

My curated development environment featuring modern CLI tools and optimized terminal workflows. Built for productivity with Neovim, Tmux, and enhanced shell experience.

## Setup

```bash
git clone https://github.com/zach-herridge/dot ~/dot
cd ~/dot
./setup.sh
```

### Shell Configuration (Zsh)
- **Starship prompt** - Fast, customizable prompt with git integration
- **Modern CLI tools** - Enhanced replacements for common commands
- **Aliases** - Productivity shortcuts for development workflow
- **Auto-completion** - Enhanced tab completion for various tools

### Terminal Multiplexer (Tmux)
- **Custom key bindings** - `Ctrl+A` prefix with intuitive split commands
- **Plugin management** - TPM with Catppuccin theme
- **Vim navigation** - Seamless pane switching with vim-tmux-navigator

### Editor (Neovim)
- **Lazy.nvim** - Modern plugin manager
- **Custom configuration** - Modular Lua-based setup
- **CloudWatch integration** - Custom plugin for AWS log viewing

### Terminal (Ghostty)
- **Catppuccin theme** - Consistent color scheme across tools
- **Optimized settings** - Performance and appearance tuned

### System Monitor (btop)
- **Custom configuration** - Resource monitoring with themes

## Tools Installed

| Tool | Purpose | Alias |
|------|---------|-------|
| `eza` | Better `ls` | `l`, `lt`, `ltree` |
| `zoxide` | Smart `cd` | `zi` |
| `ripgrep` | Fast grep | - |
| `fd` | Better find | - |
| `fzf` | Fuzzy finder | - |
| `lazygit` | Git TUI | `gt` |
| `dua-cli` | Disk usage | `view_disk` |
| `btop` | System monitor | `view_cpu` |

## Key Features

### Aliases
- `v` - Open Neovim
- `gt` - Launch Lazygit
- `c` - Clear terminal
- `reload` - Reload shell and tmux config

### Tmux Bindings
- `Ctrl+A |` - Split window horizontally
- `Ctrl+A -` - Split window vertically
- `Ctrl+A j/k/h/l` - Resize panes

### Directory Structure
```
~/dot/
├── setup.sh           # Automated installation script
├── uninstall.sh       # Removal script
├── .stowrc            # Stow configuration
├── zsh/               # Shell configuration
├── tmux/              # Terminal multiplexer config
├── nvim/              # Neovim configuration
├── ghostty/           # Terminal emulator config
├── starship/          # Prompt configuration
└── btop/              # System monitor config
```

## Customization

All configurations are modular and can be customized by editing files in their respective directories. After making changes, run `reload` to apply them.

## Uninstall

```bash
~/dot/uninstall.sh
```

## Requirements

- macOS (Homebrew-based setup)
- Git
- Internet connection for initial setup
