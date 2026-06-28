# Load order matters: every plugin that defines a ZLE widget (fzf, atuin) must
# be sourced BEFORE zsh-autosuggestions and zsh-syntax-highlighting, which wrap
# the existing widgets. zsh-syntax-highlighting in particular must be sourced
# DEAD LAST (its own docs require this) so it sees every other widget.

# --- Zoxide (smart cd) ---
command -v zoxide &>/dev/null && eval "$(zoxide init zsh)"

# --- fzf keybindings (Ctrl+T: files, Alt+C: cd) ---
# Only key-bindings, NOT completion.zsh (fzf-tab replaces it)
[[ -n $BREW_PREFIX && -f $BREW_PREFIX/opt/fzf/shell/key-bindings.zsh ]] && \
    source $BREW_PREFIX/opt/fzf/shell/key-bindings.zsh

# --- Atuin (overrides Ctrl+R and up-arrow with better TUI) ---
command -v atuin &>/dev/null && eval "$(atuin init zsh --disable-ai)"

# --- Autosuggestions (after widget-defining plugins, before syntax highlight) ---
# Config MUST be set before sourcing the plugin
ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_USE_ASYNC=1
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=200
ZSH_AUTOSUGGEST_STRATEGY=(history completion)

[[ -n $BREW_PREFIX && -f $BREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh ]] && \
    source $BREW_PREFIX/share/zsh-autosuggestions/zsh-autosuggestions.zsh

# --- Keybindings ---
bindkey '^[[C' forward-char  # Right arrow: accept suggestion char-by-char

# --- Syntax highlighting (MUST be dead last) ---
[[ -n $BREW_PREFIX && -f $BREW_PREFIX/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]] && \
    source $BREW_PREFIX/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
