# zh shell integration -- source this from .zshrc
# Wraps the zh binary to handle cd (JS can't change parent shell's cwd)

zh() {
  # Run the binary -- let stdout/stderr flow through naturally
  command zh "$@"
  local exit_code=$?

  # If nav command wrote a cd target, cd to it
  if [[ -f /tmp/zh-nav ]]; then
    cd "$(cat /tmp/zh-nav)" && rm -f /tmp/zh-nav
  fi

  return $exit_code
}

# zhi -- integration mode wrapper
# Routes to zh with --integration for commands that support it
zhi() {
  case "$1" in
    test)
      command zh "$@" --integration
      ;;
    ""|help|-h|--help)
      echo "zhi - integration mode for zh"
      echo ""
      echo "  zhi test [query]       Run integration tests"
      echo "  zhi test -a            Run all integration test suites"
      echo "  zhi test --stage <s>   Override target stage (default: devo)"
      echo ""
      echo "Options are passed through to zh test --integration"
      return 0
      ;;
    *)
      echo "zhi: '$1' doesn't have an integration mode."
      echo "Available: zhi test"
      return 1
      ;;
  esac
  local exit_code=$?

  if [[ -f /tmp/zh-nav ]]; then
    cd "$(cat /tmp/zh-nav)" && rm -f /tmp/zh-nav
  fi

  return $exit_code
}

# Tab completion for zh
_zh_completion() {
  local -a subcmds
  subcmds=(
    'status:Show status across all repos'
    'st:Show status across all repos'
    'ls:List packages'
    'each:Run command in each repo'
    'clean:Remove build artifacts'
    'rebase:Rebase all repos onto mainline'
    'prep:Squash, rebase, generate commit messages'
    'prune:Delete old branches'
    'nav:Navigate to a package'
    'build:Build packages (smart defaults)'
    'test:Run unit tests'
    'deploy:Deploy CDK stacks'
    'help:Show help'
  )

  if (( CURRENT == 2 )); then
    _describe 'subcommand' subcmds

    # Also complete package names
    local root
    root=$(command zh _root 2>/dev/null)
    if [[ -n "$root" && -d "$root/src" ]]; then
      local -a packages
      packages=(${root}/src/*(/:t))
      _describe 'package' packages
    fi
  else
    case "${words[2]}" in
      prune|prep|clean)
        _arguments \
          '--dry-run[Show what would be done]' \
          '-n[Show what would be done]'
        ;;
      status|st)
        _arguments \
          '--diff[Include diff stats]' \
          '-d[Include diff stats]' \
          '--all[Show all repos]' \
          '-a[Show all repos]'
        ;;
      build)
        _arguments \
          '-a[Build all packages]' \
          '--all[Build all packages]' \
          '-d[Build only dirty packages]' \
          '--dirty[Build only dirty packages]' \
          '--changed[Build packages changed since last deploy]' \
          '--full[Full recursive build]' \
          '--stream[Stream build output]' \
          '--fmt[Run ktlintFormat before building]' \
          '1:package:->packages'
        if [[ "$state" == "packages" ]]; then
          local root
          root=$(command zh _root 2>/dev/null)
          if [[ -n "$root" && -d "$root/src" ]]; then
            local -a packages
            packages=(${root}/src/*(/:t))
            _describe 'package' packages
          fi
        fi
        ;;
      test)
        _arguments \
          '-a[Test all packages]' \
          '--all[Test all packages]' \
          '-i[Run integration tests]' \
          '--integration[Run integration tests]' \
          '-r[Rerun failed tests from last run]' \
          '--retry[Rerun failed tests from last run]' \
          '--stage[Stage for integration tests]:stage:(devo beta gamma)' \
          '--region[AWS region]:region:(us-east-1 us-west-2)' \
          '1:package:->packages'
        if [[ "$state" == "packages" ]]; then
          local root
          root=$(command zh _root 2>/dev/null)
          if [[ -n "$root" && -d "$root/src" ]]; then
            local -a packages
            packages=(${root}/src/*(/:t))
            _describe 'package' packages
          fi
        fi
        ;;
      deploy)
        _arguments \
          '--redo[Repeat last deployment]' \
          '--diff[Show CDK diff before deploying]' \
          '--hotswap[Lambda-only hotswap deploy]' \
          '--full[Full recursive build first]' \
          '--no-build[Skip all builds]' \
          '--history[Show deployment log]' \
          '--override[Override stage guardrails]' \
          '1:stack:(service foundational toolbox service@devo service@beta service@gamma found@devo found@beta svc fr)'
        ;;
      each)
        shift words
        (( CURRENT-- ))
        _normal
        ;;
      *)
        _files
        ;;
    esac
  fi
}
compdef _zh_completion zh

# Tab completion for zhi
_zhi_completion() {
  if (( CURRENT == 2 )); then
    local -a subcmds
    subcmds=('test:Run integration tests')
    _describe 'subcommand' subcmds
  else
    case "${words[2]}" in
      test)
        _arguments \
          '-a[Run all integration test suites]' \
          '--all[Run all integration test suites]' \
          '-r[Rerun failed tests from last run]' \
          '--retry[Rerun failed tests from last run]' \
          '--stage[Target stage]:stage:(devo beta gamma alpha)' \
          '--region[AWS region]:region:(us-east-1 us-west-2)' \
          '1:package:->packages'
        if [[ "$state" == "packages" ]]; then
          local root
          root=$(command zh _root 2>/dev/null)
          if [[ -n "$root" && -d "$root/src" ]]; then
            local -a packages
            packages=(${root}/src/*(/:t))
            # Filter to only integration test packages
            packages=(${(M)packages:#*[Ii]ntegration[Tt]ests*})
            _describe 'package' packages
          fi
        fi
        ;;
    esac
  fi
}
compdef _zhi_completion zhi
