#Install homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

#Install git
brew install git

#Clone this repo
git clone https://github.com/zach-herridge/.dotfiles ~/zenv

#Add homebrew to path (replace username)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> /Users/[username]/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

#Install iterm2
brew install --cask iterm2

#Install fd
brew install fd

#Install tmux
brew install tmux

#Syslink tmux
ln -s ~/zenv/.tmux.conf ~/

#Install gh
brew install gh

#Install tpm
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

#Install fzf
brew install fzf

#Install ripgrep
brew install ripgrep

#Install sqllite
brew install sqllite

#Install git
brew install git

#Install oh-my-zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

#Install powerlevel10k
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k

#Install zh plugins
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions

git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

#Syslink .zshrc
ln -s ~/zenv/.zshrc ~/.zshrc

#Install neovim (install the latest version to get inlays)
brew install --HEAD neovim

#Syslink nvm
ln -s ~/zenv/nvim ~/.config

#Manual steps

#Configure powerlevel
#reopen iterm and/or p10k configure

#Set item color to the theme in this folder
#Go to Profiles > Colors > Import

#Install tmux plugins
#enter tmux and run `ctrl + a I`

