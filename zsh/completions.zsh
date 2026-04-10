# Enable completion system
# Always use cached compinit (-C) for fast startup.
# Full rebuild happens in background, or manually: `compinit`
autoload -Uz compinit
compinit -C -d "${HOME}/.zcompdump"

# Rebuild dump in background if it's stale (>24h old)
if [[ -n ${HOME}/.zcompdump(#qN.mh+24) ]]; then
  { compinit -d "${HOME}/.zcompdump" } &!
fi

# Load complist module for menuselect keymap
zmodload zsh/complist

# --- Completers ---
# _complete: standard, _match: globbing, _approximate: typo tolerance
zstyle ':completion:*' completer _complete _match _approximate
zstyle ':completion:*:approximate:*' max-errors 2

# --- Matching ---
# Case-insensitive, partial-word, substring
zstyle ':completion:*' matcher-list \
  'm:{a-zA-Z}={A-Za-z}' \
  'r:|[._-]=* r:|=*' \
  'l:|=* r:|=*'

# --- Display ---
zstyle ':completion:*' menu select
zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*' group-name ''
zstyle ':completion:*:descriptions' format '%F{magenta}-- %d --%f'
zstyle ':completion:*:messages' format '%F{yellow}-- %d --%f'
zstyle ':completion:*:warnings' format '%F{red}-- no matches --%f'

# --- Directory completion ---
zstyle ':completion:*:cd:*' tag-order local-directories directory-stack path-directories
zstyle ':completion:*:*:cd:*:directory-stack' menu yes select
zstyle ':completion:*:-command-:*:' verbose false

# --- Caching ---
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path "${HOME}/.zcompcache"

# --- Menu navigation ---
bindkey -M menuselect '^M' accept-line
bindkey -M menuselect '^[[Z' reverse-menu-complete
bindkey -M menuselect '^?' undo
bindkey -M menuselect 'h' vi-backward-char
bindkey -M menuselect 'j' vi-down-line-or-history
bindkey -M menuselect 'k' vi-up-line-or-history
bindkey -M menuselect 'l' vi-forward-char

# --- fzf-tab (must be after compinit, before other plugins) ---
source $BREW_PREFIX/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh

# fzf-tab: general
zstyle ':fzf-tab:*' fzf-flags --height=50% --layout=reverse --border=rounded
zstyle ':fzf-tab:*' switch-group ',' '.'
zstyle ':fzf-tab:*' continuous-trigger '/'

# fzf-tab: preview for files and directories
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'eza --tree --level=1 --icons --color=always $realpath 2>/dev/null'
zstyle ':fzf-tab:complete:ls:*' fzf-preview 'eza --tree --level=1 --icons --color=always $realpath 2>/dev/null'
zstyle ':fzf-tab:complete:eza:*' fzf-preview 'eza --tree --level=1 --icons --color=always $realpath 2>/dev/null'
zstyle ':fzf-tab:complete:cat:*' fzf-preview 'bat --style=numbers --color=always --line-range=:50 $realpath 2>/dev/null'
zstyle ':fzf-tab:complete:bat:*' fzf-preview 'bat --style=numbers --color=always --line-range=:50 $realpath 2>/dev/null'
zstyle ':fzf-tab:complete:nvim:*' fzf-preview 'bat --style=numbers --color=always --line-range=:50 $realpath 2>/dev/null'
zstyle ':fzf-tab:complete:v:*' fzf-preview 'bat --style=numbers --color=always --line-range=:50 $realpath 2>/dev/null'

# fzf-tab: generic file/dir preview as fallback
zstyle ':fzf-tab:complete:*:*' fzf-preview \
  'if [[ -d $realpath ]]; then eza --tree --level=1 --icons --color=always $realpath 2>/dev/null; elif [[ -f $realpath ]]; then bat --style=numbers --color=always --line-range=:50 $realpath 2>/dev/null; fi'

# fzf-tab: git checkout completion
zstyle ':fzf-tab:complete:git-(checkout|switch):*' fzf-preview \
  'git log --oneline --graph --color=always --date=short -20 $word 2>/dev/null'

# fzf-tab: process completion for kill
zstyle ':fzf-tab:complete:(kill|ps):argument-rest' fzf-preview \
  'ps -p $word -o pid,user,%cpu,%mem,command 2>/dev/null | tail -1'
zstyle ':fzf-tab:complete:(kill|ps):argument-rest' fzf-flags --preview-window=down:3:wrap
