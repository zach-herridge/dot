# Workspace CLI - unified workspace management

ws() {
    case "$1" in
        "") _ws_help ;;
        clean) shift; _ws_clean "$@" ;;
        prune) shift; _ws_prune "$@" ;;
        branches|br) shift; _ws_branches "$@" ;;
        status|st) shift; _ws_status "$@" ;;
        rebase) shift; _ws_rebase "$@" ;;
        prep) shift; _ws_prep "$@" ;;
        each) shift; _ws_each "$@" ;;
        root) cd "$(_ws_root)" && echo "→ ${PWD##*/}" ;;
        ls) _ws_ls ;;
        diff) _ws_diff ;;
        help|-h) _ws_help ;;
        *) _ws_go "$@" ;;
    esac
}

_ws_help() {
    cat <<EOF
ws - workspace CLI

  ws <dir> [cmd]    Navigate to subdir, or run cmd there
  ws each <cmd>     Run cmd in each repo
  ws ls             List packages
  ws diff           Show diffs across repos
  ws clean          Remove build artifacts
  ws prune [-n]     Delete old local & remote branches (yours)
  ws branches|br    Show branches across repos  
  ws status|st      Show dirty repos
  ws rebase         Rebase all clean repos onto mainline
  ws prep           Squash, rebase, generate commit msg with kiro
  ws root           Go to workspace root
  ws help           This help
EOF
}

_ws_root() {
    local root="$PWD"
    while [[ "$root" != "/" && ! -f "$root/packageInfo" ]]; do root=$(dirname "$root"); done
    [[ -f "$root/packageInfo" ]] && echo "$root" || return 1
}

_ws_repos() {
    local root=$(_ws_root) || return 1
    find "$root/src" -maxdepth 2 -name ".git" -type d 2>/dev/null | while read g; do dirname "$g"; done
}

_ws_go() {
    [[ -z "$1" ]] && { _ws_help; return 1; }
    local do_cd=false
    [[ "$1" == "cd" ]] && { do_cd=true; shift; }
    local target="$1"; shift
    local root=$(_ws_root) || { echo "No workspace root found"; return 1; }
    local matches=($(find "$root/src" -maxdepth 1 -type d -iname "*$target*"))
    local dir
    case ${#matches[@]} in
        0) echo "No match for '$target'"; return 1 ;;
        1) dir="${matches[1]}" ;;
        *) dir=$(printf '%s\n' "${matches[@]}" | fzf --height=10) || return 1 ;;
    esac
    if $do_cd || [[ $# -eq 0 ]]; then
        cd "$dir" && echo "→ ${dir##*/}"
    else
        echo "→ ${dir##*/}: $*"
        (cd "$dir" && eval "$@")
    fi
}

_ws_each() {
    _ws_repos | while read r; do
        echo "=== ${r##*/} ==="
        (cd "$r" && eval "$@")
    done
}

_ws_clean() {
    local root=$(_ws_root) || { echo "No workspace root found"; return 1; }
    echo "Cleaning $root"
    rm -rf "$root"/{node_modules,build,dist,env}
    find "$root/src" -maxdepth 2 -type d \( -name node_modules -o -name build -o -name dist \) -exec rm -rf {} + 2>/dev/null
}

_ws_branches() {
    _ws_repos | while read r; do
        local name="${r##*/}" dirty=""
        git -C "$r" diff --quiet 2>/dev/null || dirty="*"
        git -C "$r" for-each-ref --format="%(committerdate:iso)|%(refname:short)|$name$dirty|%(upstream:trackshort)" refs/heads 2>/dev/null
    done | sort -t'|' -k2,2 -k1,1r | awk -F'|' '!seen[$2]++ {printf "%s | %-20s | %-15s | %s\n", $1, $2, $3, $4}' | sort -r
}

_ws_status() {
    _ws_repos | while read r; do
        local st=$(git -C "$r" status --porcelain 2>/dev/null)
        [[ -n "$st" ]] && echo "${r##*/}: $(echo "$st" | wc -l | tr -d ' ') dirty"
    done
}

_ws_rebase() {
    _ws_repos | while read r; do
        echo "=== ${r##*/} ==="
        if [[ -n "$(git -C "$r" status --porcelain)" ]]; then
            echo "SKIP: dirty"
        else
            git -C "$r" fetch origin mainline && git -C "$r" rebase origin/mainline || echo "CONFLICT"
        fi
    done
}

_ws_prep() {
    local dry_run=false
    [[ "$1" == "--dry-run" || "$1" == "-n" ]] && dry_run=true
    
    # Check for any dirty repos first
    local dirty_repos=()
    while read r; do
        [[ -n "$(git -C "$r" status --porcelain)" ]] && dirty_repos+=("$r")
    done < <(_ws_repos)
    
    if [[ ${#dirty_repos[@]} -gt 0 ]]; then
        echo "Dirty repos found:"
        for r in "${dirty_repos[@]}"; do
            echo "  ${r##*/}:"
            git -C "$r" status --porcelain | sed 's/^/    /'
        done
        echo ""
        echo -n "Commit all with WIP message before prep? [y/N] "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            for r in "${dirty_repos[@]}"; do
                echo "Committing ${r##*/}..."
                git -C "$r" add -A && git -C "$r" commit -m "WIP"
            done
            echo ""
        else
            echo "Aborted."
            return 1
        fi
    fi
    
    _ws_repos | while read r; do
        local name="${r##*/}"
        
        git -C "$r" fetch origin mainline 2>/dev/null
        local ahead=$(git -C "$r" rev-list --count origin/mainline..HEAD 2>/dev/null || echo 0)
        if [[ "$ahead" -eq 0 ]]; then
            echo "=== $name === (up to date)"
            continue
        fi
        
        echo "=== $name ($ahead commits) ==="
        
        if $dry_run; then
            echo "Would squash and generate commit message"
            git -C "$r" log --oneline origin/mainline..HEAD | sed 's/^/  /'
            continue
        fi
        
        # Create backup branch
        local branch=$(git -C "$r" branch --show-current)
        local backup="backup/${branch}-$(date +%Y%m%d-%H%M%S)"
        git -C "$r" branch "$backup"
        echo "Backup: $backup"
        
        # Rebase
        if ! git -C "$r" rebase origin/mainline 2>/dev/null; then
            echo "CONFLICT: resolve or abort"
            continue
        fi
        
        # Get original messages before squash
        local orig_msgs=$(git -C "$r" log --format="- %s" origin/mainline..HEAD)
        
        # Squash into one commit
        git -C "$r" reset --soft origin/mainline
        git -C "$r" commit -m "WIP: squashed for CR"
        
        # Generate commit message with kiro
        local diffstat=$(git -C "$r" diff origin/mainline --stat)
        # Escape @ symbols to prevent kiro from expanding them as file references
        local diff=$(git -C "$r" diff origin/mainline -- ':!package-lock.json' ':!*.lock' | head -300 | sed 's/@/AT/g')
        local prompt="Generate a git commit message for this diff. Format:
- Line 1: concise title (max 72 chars, imperative mood)
- Line 2: blank  
- Lines 3+: bullet points summarizing key changes

Wrap response in markers exactly like this example:
COMMIT_START
Add label filtering to search API

- Extract label filters from search attributes
- Apply filters as term queries in OpenSearch
- Add unit tests for filter building
COMMIT_END

Original commits:
$orig_msgs

Stat:
$diffstat

Diff (truncated, excludes lockfiles, AT = @):
$diff"
        
        echo "Generating commit message..."
        local tmpfile="/tmp/kiro-commit-$(basename "$r").txt"
        TERM=dumb kiro-cli chat --no-interactive --trust-all-tools "$prompt" > "$tmpfile" 2>&1
        
        # Extract content between markers (robust to UI chrome)
        local new_msg=$(cat "$tmpfile" \
            | LC_ALL=C sed $'s/\033\\[[0-9;]*[a-zA-Z]//g' \
            | tr -d '\r' \
            | sed -n '/COMMIT_START/,/COMMIT_END/p' \
            | grep -v 'COMMIT_START\|COMMIT_END' \
            | sed '/^[[:space:]]*$/d')
        
        if [[ -n "$new_msg" ]]; then
            git -C "$r" commit --amend -m "$new_msg"
            rm -f "$tmpfile"
            echo "✓ Ready for CR"
        else
            echo "⚠ Kiro failed, keeping WIP message. Run: git commit --amend"
            echo "  Raw output: $tmpfile"
        fi
    done
}

_ws_prune() {
    local dry_run=false
    [[ "$1" == "--dry-run" || "$1" == "-n" ]] && { dry_run=true; shift; }
    local me="${1:-zachhe}"
    
    _ws_repos | while read r; do
        local name="${r##*/}"
        echo "=== $name ==="
        
        # Local branches (not mainline, not current)
        git -C "$r" for-each-ref --format='%(refname:short)' refs/heads | while read b; do
            [[ "$b" == "mainline" || "$b" == "$(git -C "$r" branch --show-current)" ]] && continue
            if $dry_run; then echo "  local: $b"; else git -C "$r" branch -D "$b" 2>/dev/null && echo "  deleted local: $b"; fi
        done
        
        # Remote branches owned by me
        git -C "$r" fetch --prune origin 2>/dev/null
        git -C "$r" for-each-ref --format='%(refname:short)' refs/remotes/origin | grep "/$me/" | while read b; do
            local remote_branch="${b#origin/}"
            if $dry_run; then echo "  remote: $remote_branch"; else git -C "$r" push origin --delete "$remote_branch" 2>/dev/null && echo "  deleted remote: $remote_branch"; fi
        done
    done
}

_ws_ls() {
    local root=$(_ws_root) || { echo "No workspace root found"; return 1; }
    find "$root/src" -maxdepth 1 -type d | while read d; do
        [[ "$d" == "$root/src" ]] && continue
        echo "${d##*/}"
    done | sort
}

_ws_diff() {
    _ws_repos | while read r; do
        local diff=$(git -C "$r" diff --stat 2>/dev/null)
        [[ -n "$diff" ]] && echo "=== ${r##*/} ===" && echo "$diff"
    done
}
