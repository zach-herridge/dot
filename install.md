Install homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

Add homebrew to path (replace username)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> /Users/[username]/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

Install iterm2
brew install --cask iterm2

Install fd
brew install fd

Install ripgrep
brew install ripgrep

Install git
brew install git

Install oh-my-zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

Install powerlevel10k
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k

Configure powerlevel
reopen iterm and/or p10k configure

Set item color to the theme in this folder
Go to Profiles > Colors > Import

Install zh plugins
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions

git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

Syslink .zshrc
ln -s ~/zenv/.zshrc ~/.zshrc

Refresh term
source ~/.zshrc

Install neovim (install the latest version to get inlays)
brew install --HEAD neovim

Syslink nvm
ln -s ~/zenv/nvim ~/.config


