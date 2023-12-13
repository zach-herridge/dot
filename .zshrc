if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

eval "$(/opt/homebrew/bin/brew shellenv)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

path+=("$HOME/.toolbox/bin/")

export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="powerlevel10k/powerlevel10k"

plugins=(git z web-search zsh-autosuggestions zsh-syntax-highlighting)

source $ZSH/oh-my-zsh.sh

[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

alias vim="nvim"
alias v="nvim"
alias bb="brazil-build"
alias bbb="brazil-recursive-cmd -all brazil-build --reverse"
alias gg="./gradlew"
alias gt="lazygit"
alias cd="z"
alias ci="zi"
alias cat="bat"
alias c="clear"
alias zh="cat ~/dot/help/tips.md"
alias lt="exa -T -L 3 --icons --git-ignore"
alias ls="exa -a -l --no-permissions --icons --no-user -h -s extension"
alias lss="exa -a -l --no-permissions --icons --no-user -h -s size -r"
alias devd="ssh dev-dsk-zachhe-1a-0f9127f8.us-east-1.amazon.com"

function ghpr() {
  GH_FORCE_TTY=100% gh pr list | fzf --ansi --preview 'GH_FORCE_TTY=100% gh pr view {1}' --preview-window down --header-lines 3 | awk '{print $1}' | xargs gh pr checkout
}

function bbcdi() {
  fd -L -I -p cdk.out -e template.json | sed -e 's/build\/cdk.out\///g' | sed -e 's/.template.json//g' | fzf | awk '{print $1}' | xargs brazil-build cdk deploy {}
}

eval "$(zoxide init zsh)"

export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
