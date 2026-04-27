# History configuration
HISTSIZE=5000000
SAVEHIST=5000000
HISTFILE=~/.zsh_history

# History options
setopt HIST_IGNORE_ALL_DUPS    # Remove older duplicate (subsumes HIST_IGNORE_DUPS)
setopt HIST_SAVE_NO_DUPS       # Don't write duplicates to file
setopt HIST_VERIFY             # Show expanded history before executing
setopt SHARE_HISTORY           # Share across sessions (implies INC_APPEND + APPEND)
