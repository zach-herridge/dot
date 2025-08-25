#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Usage: gall <command>"
    echo "Example: gall git pull"
    echo "         gall git status"
    echo "         gall ls -la"
    exit 1
fi

# Store the command
COMMAND="$*"

# Print a separator line with repository name
print_repo_header() {
    echo -e "\n=== $1 ==="
}

# Find all .git directories and execute the command
find . -type d -name .git -prune | while read gitdir; do
    dir=${gitdir%/.git}
    print_repo_header "$dir"
    (cd "$dir" && eval "$COMMAND")
done

