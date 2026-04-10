export STARSHIP_CONFIG=~/.config/starship/starship.toml
export EDITOR=nvim
export AWS_DEFAULT_REGION=us-east-1
export RIPGREP_CONFIG_PATH=~/dot/ripgrep/config

# fzf configuration
export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git'
export FZF_DEFAULT_OPTS=" \
  --layout=reverse \
  --info=right \
  --height=60% \
  --border=rounded \
  --prompt='> ' \
  --pointer='>' \
  --marker='>' \
  --separator='─' \
  --scrollbar='│' \
  --color=bg+:#313244,bg:#1e1e2e,spinner:#f5e0dc,hl:#f38ba8 \
  --color=fg:#cdd6f4,header:#f38ba8,info:#cba6f7,pointer:#f5e0dc \
  --color=marker:#b4befe,fg+:#cdd6f4,prompt:#cba6f7,hl+:#f38ba8 \
  --color=selected-bg:#45475a \
  --color=border:#6c7086,label:#cdd6f4 \
"
export FZF_CTRL_T_COMMAND='fd --type f --hidden --follow --exclude .git'
export FZF_CTRL_T_OPTS="--preview 'bat --style=numbers --color=always --line-range=:80 {} 2>/dev/null || head -80 {}' --preview-window=right:50%:wrap"
export FZF_ALT_C_COMMAND='fd --type d --hidden --follow --exclude .git'
export FZF_ALT_C_OPTS="--preview 'eza --tree --level=1 --icons --color=always {}'"
