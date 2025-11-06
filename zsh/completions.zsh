# Enable completion system
autoload -Uz compinit
if [[ -n ${HOME}/.zcompdump(#qN.mh+24) ]]; then
  compinit -d "${HOME}/.zcompdump"
else
  compinit -C -d "${HOME}/.zcompdump"
fi

# Enable completion for all commands
zstyle ':completion:*' completer _complete _match _approximate
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|[._-]=* r:|=*' 'l:|=* r:|=*'
zstyle ':completion:*' menu select
zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}

# Better approximate matching
zstyle ':completion:*:approximate:*' max-errors 2

# Enable file completion for cd and other commands
zstyle ':completion:*:cd:*' tag-order local-directories directory-stack path-directories
zstyle ':completion:*:*:cd:*:directory-stack' menu yes select
zstyle ':completion:*:-command-:*:' verbose false

# Completion caching for speed
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path "${HOME}/.zcompcache"

# Load complist module for menuselect keymap
zmodload zsh/complist

# Auto-select first completion item
zstyle ':completion:*' menu select

# Better completion menu navigation
bindkey -M menuselect '^M' accept-line          # Enter to accept
bindkey -M menuselect '^[[Z' reverse-menu-complete  # Shift+Tab to go backwards
bindkey -M menuselect '^?' undo                     # Backspace to undo
# Keep default Up/Down behavior (accept current + history navigation)