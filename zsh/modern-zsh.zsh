# --- Zoxide (smart cd) ---
eval "$(zoxide init zsh)"

# --- Autosuggestions ---
# Config MUST be set before sourcing the plugin
ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_USE_ASYNC=1
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=200
ZSH_AUTOSUGGEST_STRATEGY=(history completion)

source $BREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh

# --- Syntax highlighting (must be near end) ---
source $BREW_PREFIX/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# --- fzf keybindings (Ctrl+T: files, Alt+C: cd) ---
# Only key-bindings, NOT completion.zsh (fzf-tab replaces it)
source $BREW_PREFIX/opt/fzf/shell/key-bindings.zsh

# --- Atuin (overrides Ctrl+R and up-arrow with better TUI) ---
eval "$(atuin init zsh)"

# --- Keybindings ---
bindkey '^[[C' forward-char  # Right arrow: accept suggestion char-by-char
