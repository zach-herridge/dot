eval "$(zoxide init zsh)"

source $(brew --prefix)/share/zsh-autosuggestions/zsh-autosuggestions.zsh
source $(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_USE_ASYNC=1
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20

bindkey '^R' history-incremental-search-backward
bindkey '^[[A' history-search-backward
bindkey '^[[B' history-search-forward
# bindkey '^I' autosuggest-accept  # Disabled to allow tab completion
bindkey '^[[C' forward-char

