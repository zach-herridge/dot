#Install homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> /Users/$USER/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

#Install git
brew install git

#Clone this repo
git clone https://github.com/zach-herridge/dot ~/dot

brew install zoxide
brew install --cask iterm2
brew install fd
brew install gimp
brew install exa
brew install bat
brew install tmux
brew install lazygit
brew install gh
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
brew install fzf
brew install ripgrep
brew install sqllite
#Install neovim (install the latest version to get inlays)
brew install --HEAD neovim

#Install oh-my-zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

#Install powerlevel10k
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k

#Install zh plugins
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

#Sys links
ln -sf ~/dot/.tmux.conf ~/
ln -sf ~/dot/.p10k.zsh ~/
ln -sf ~/dot/.zshrc ~/
ln -sf ~/dot/nvim ~/.config

echo "Install complete! :)"

#Manual steps

#Set item color to the theme in this folder
#Go to Profiles > Colors > Import

#Install tmux plugins
#enter tmux and run `ctrl + a I`

#ITerm2 -> Preferences -> Profiles -> keys -> General -> Choose "left Option key " 

#Mac disable smart qoutes in prefs -> keyboard -> input
