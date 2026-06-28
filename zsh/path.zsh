path+=("$HOME/.toolbox/bin/")
path+=("$HOME/dot/zh/bin")
path+=("$HOME/dot/bin")

# macOS Docker desktop
[[ -d "/Applications/Docker.app/Contents/Resources/bin" ]] && \
    path+=("/Applications/Docker.app/Contents/Resources/bin")
