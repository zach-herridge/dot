#!/bin/bash

# Function to get branch and format output
get_branch_info() {
    dir=$1
    branch=$(cd "$dir" && git branch --show-current)
    echo "$dir: $branch"
}

# Collect all git repositories and their branches
repos=()
while IFS= read -r -d '' dir; do
    branch=$(cd "${dir%/.git}" && git branch --show-current)
    repos+=("${dir%/.git}:$branch")
done < <(find . -type d -name .git -print0)

# Sort and output
{
    echo "---"
    printf '%s\n' "${repos[@]}" | sort | while IFS=: read -r dir branch; do
        if [ "$branch" = "mainline" ]; then
            echo "$dir: $branch"
        fi
    done
    echo "---"
    printf '%s\n' "${repos[@]}" | sort | while IFS=: read -r dir branch; do
        if [ "$branch" != "mainline" ]; then
            echo "$dir: $branch"
        fi
    done
} | sed 's|^\./||'


