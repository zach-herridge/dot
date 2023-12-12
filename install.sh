#Install homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> /Users/$USER/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

#Install git
brew install git

#Clone this repo
git clone https://github.com/zach-herridge/dot ~/dot

#Install brew stuff
brew install zoxide
brew install fd
brew install wget
brew install exa
brew install bat
brew install tmux
brew install lazygit
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
brew install fzf
brew install ripgrep
#install the latest version to get inlay hints
brew install --HEAD neovim

#Install oh-my-zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

#Install powerlevel10k
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k

#Install zsh plugins
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

#Sys links
ln -sf ~/dot/.tmux.conf ~/
ln -sf ~/dot/.p10k.zsh ~/
ln -sf ~/dot/.zshrc ~/
ln -sf ~/dot/nvim ~/.config

echo "Install complete! Remeber to follow the manual steps described in manual.md :)"
echo "Also run install_optional.sh for additional features"

