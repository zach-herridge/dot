# Cross-platform clipboard: provide pbcopy/pbpaste on Linux so the same code
# (clc, `… | pbcopy`, etc.) works on the Mac and on remote dev boxes alike.
#
# macOS already ships pbcopy/pbpaste — leave them alone. On Linux pick the best
# available sink in priority order: Wayland, X11, then tmux's OSC 52 relay,
# which is what actually works on a headless SSH box (no display, no xclip):
# `tmux load-buffer -w -` hands the bytes to the tmux server, which emits OSC 52
# to the attached terminal (kitty) and on to the system clipboard.
if [[ "$(uname -s)" != "Darwin" ]]; then
  if ! command -v pbcopy &>/dev/null; then
    pbcopy() {
      if command -v wl-copy &>/dev/null; then
        wl-copy
      elif command -v xclip &>/dev/null; then
        xclip -selection clipboard
      elif command -v xsel &>/dev/null; then
        xsel --clipboard --input
      elif [[ -n "${TMUX:-}" ]]; then
        tmux load-buffer -w -
      else
        # Last resort: raw OSC 52 straight to the terminal.
        printf '\033]52;c;%s\a' "$(base64 | tr -d '\n')" > /dev/tty
      fi
    }
  fi

  if ! command -v pbpaste &>/dev/null; then
    pbpaste() {
      if command -v wl-paste &>/dev/null; then
        wl-paste --no-newline
      elif command -v xclip &>/dev/null; then
        xclip -selection clipboard -o
      elif command -v xsel &>/dev/null; then
        xsel --clipboard --output
      elif [[ -n "${TMUX:-}" ]]; then
        tmux show-buffer
      else
        echo "pbpaste: no clipboard source available" >&2
        return 1
      fi
    }
  fi
fi
