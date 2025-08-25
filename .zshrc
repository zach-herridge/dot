if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

eval "$(/opt/homebrew/bin/brew shellenv)"
#eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

path+=("$HOME/.toolbox/bin/")
path+=("/Applications/Docker.app/Contents/Resources/bin")

export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="powerlevel10k/powerlevel10k"

plugins=(git z web-search zsh-autosuggestions zsh-syntax-highlighting)

source $ZSH/oh-my-zsh.sh

[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

alias v="nvim"
alias bb="brazil-build"
alias bbb="brazil-recursive-cmd -all brazil-build --reverse"
alias bbk="bb ktlintFormat; bb"
alias bws="brazil ws --sync --md"
alias gg="./gradlew"
alias gt="lazygit"
alias ci="zi"
alias cat="bat"
alias c="clear"
alias zh="cat ~/dot/help/tips.md"
alias gbc=". ~/dot/git_branch_check.sh"
alias gbp=". ~/dot/git_pull.sh"
alias devd="ssh dev-dsk-zachhe-1a-0f9127f8.us-east-1.amazon.com"


function inrepos() {
    for d in */; do
        if [ -d "$d/.git" ]; then
            echo -e "\n=== $d ==="
            (cd "$d" && "$@")
        fi
    done
}


eval "$(zoxide init zsh)"

git config --global push.autoSetupRemote true

export PATH=$PATH:$HOME/.toolbox/bin
