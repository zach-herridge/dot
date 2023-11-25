if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="powerlevel10k/powerlevel10k"

plugins=(git web-search zsh-autosuggestions zsh-syntax-highlighting)

source $ZSH/oh-my-zsh.sh

[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

alias vim="nvim"
alias bb="brazil-build"
alias gg="./gradlew"
alias cd="z"
alias gt="lazygit"
alias cat="bat"
alias cc="clear"
alias zh="cat ~/zenv/help/tips.md"
alias lt="exa -T -L 3 --git-ignore"
alias ls="exa -a -l --no-permissions --no-user -h -s extension"
alias lss="exa -a -l --no-permissions --no-user -h -s size -r"

eval "$(zoxide init zsh)"

export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
