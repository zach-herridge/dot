# Git Status Panel

A Neovim plugin that provides a clean, interactive git status panel in a vertical split. Designed for efficient git workflow management with support for both single repositories and multi-package Brazil workspaces.

## Features

- **Clean Interface**: Shows git status in a vertical split with just filenames for clarity
- **Branch Information**: Displays current branch in title for single repos, per-package for multi-repos
- **Multi-Repository Support**: Automatically detects Brazil workspaces and shows status across all packages
- **Interactive Operations**: Stage, unstage, revert, delete, and open files directly from the panel
- **Diff Integration**: View file diffs using diffview.nvim with `p` key
- **Smart Filtering**: Toggle between all changes and unstaged-only views
- **File Navigation**: Jump between changed files without opening the panel
- **Current File Indicator**: Shows which file you currently have open with a `>` marker
- **Auto-refresh**: Keeps status up-to-date with configurable refresh interval
- **Git Status Cheatsheet**: Built-in reference for git status codes

## Installation

Using lazy.nvim:

```lua
{
  "git-status-panel",
  dev = true,
  dir = vim.fn.stdpath("config") .. "/lua/zach/git-status-panel",
  dependencies = {
    {
      "sindrets/diffview.nvim",
      opts = {
        keymaps = {
          view = {
            ["q"] = "<cmd>DiffviewClose<cr>",
          },
          file_panel = {
            ["q"] = "<cmd>DiffviewClose<cr>",
          },
          file_history_panel = {
            ["q"] = "<cmd>DiffviewClose<cr>",
          },
        },
      },
    },
  },
  config = function()
    require("zach.git-status-panel").setup({
      refresh_interval = 5000, -- Auto-refresh every 5 seconds (0 to disable)
      window = {
        position = "right",
        width = 40,
        height = 0.8,
      },
    })
  end,
  keys = {
    { "<leader>gs", "<cmd>GitStatusPanel<cr>", desc = "Toggle Git Status Panel" },
    { "<leader>gS", "<cmd>GitStatusPanelUnstaged<cr>", desc = "Toggle Git Status Panel (Unstaged)" },
    { "<leader>gJ", function() require("zach.git-status-panel").jump_to_next_file() end, desc = "Jump to next git file" },
    { "<leader>gK", function() require("zach.git-status-panel").jump_to_prev_file() end, desc = "Jump to previous git file" },
  },
}
```

## Usage

### Opening the Panel

- `<leader>gs` - Toggle panel showing all git changes
- `<leader>gS` - Toggle panel showing only unstaged changes

### Panel Navigation

- `<CR>` or `o` - Open file under cursor
- `q` or `<Esc>` - Close panel
- `R` - Manual refresh

### File Operations

- `<Tab>` - Stage/unstage file (smart toggle based on current status)
- `r` - Revert changes to file (with confirmation)
- `d` - Delete file (with confirmation)
- `p` - Show diff for file (opens in diffview, close with `q`)

### File Navigation (Global)

- `<leader>gJ` - Jump to next file in git status
- `<leader>gK` - Jump to previous file in git status

## Panel Display

### Single Repository
```
Git Status [main]
-----------------

 M package.json          <- Modified file
AM component.tsx         <- Added and modified
>M current-file.js       <- Currently open file (indicated by >)
?? new-file.ts           <- Untracked file

Cheatsheet:
M  = Modified
A  = Added
D  = Deleted
R  = Renamed
C  = Copied
?? = Untracked
MM = Modified (staged + unstaged)
AM = Added + modified
```

### Multi-Repository (Brazil Workspace)
```
Git Status
----------

[PortageServiceCore-1.0] (feature/new-api)
 M Service.kt
AM Utils.kt

[PortageUtilsKotlin-1.0] (main)
?? NewUtil.kt

Cheatsheet:
M  = Modified
A  = Added
D  = Deleted
R  = Renamed
C  = Copied
?? = Untracked
MM = Modified (staged + unstaged)
AM = Added + modified
```

## Multi-Repository Support

The plugin automatically detects Brazil workspaces by looking for a `packageInfo` file in the current directory. When found, it:

1. Scans the `src/` directory for package subdirectories
2. Checks each package for git repositories
3. Shows git status across all packages with branch information
4. Groups files by package name with `[PackageName] (branch)` headers

## Smart Staging Logic

The `<Tab>` key intelligently stages or unstages files based on their current status:

- **Unstaged files** (`M`, `??`) → Stage them
- **Files with unstaged changes** (`MM`, `AM`) → Stage the unstaged changes
- **Fully staged files** (`A`, `M `) → Unstage them

## Diff Integration

Press `p` on any file to view its diff using diffview.nvim:
- Shows current changes against HEAD
- File panel is automatically hidden for cleaner view
- Press `q` to close diffview and return to your workflow
- Supports all diffview navigation and features

## Configuration

```lua
require("zach.git-status-panel").setup({
  refresh_interval = 5000, -- Auto-refresh interval in ms (0 to disable)
  window = {
    position = "right",     -- Panel position
    width = 40,             -- Panel width in columns
    height = 0.8,           -- Panel height as fraction of screen
  },
})
```

## Commands

- `:GitStatusPanel` - Toggle main git status panel
- `:GitStatusPanelUnstaged` - Toggle unstaged-only panel

## Architecture

The plugin consists of three main modules:

- **`init.lua`** - Main plugin interface, commands, and mode management
- **`git.lua`** - Git operations, repository discovery, and branch information (with Brazil workspace support)
- **`panel.lua`** - UI management, keymaps, file operations, and diffview integration

All git operations are performed asynchronously using `vim.system()` to prevent blocking the UI.

## Git Status Codes Reference

| Code | Meaning |
|------|---------|
| `M ` | Modified (staged) |
| ` M` | Modified (unstaged) |
| `MM` | Modified (both staged and unstaged) |
| `A ` | Added (staged) |
| `AM` | Added (staged) + modified (unstaged) |
| `D ` | Deleted (staged) |
| ` D` | Deleted (unstaged) |
| `R ` | Renamed |
| `C ` | Copied |
| `??` | Untracked |

## Requirements

- Neovim 0.7+
- Git command line tool
- sindrets/diffview.nvim (automatically installed as dependency)
- Optional: Brazil workspace setup for multi-repository support
