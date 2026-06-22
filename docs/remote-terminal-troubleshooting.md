# Remote Terminal Troubleshooting

Notes from debugging a remote dev box (kitty on Mac → `ssh` → tmux → nvim).
Captures three issues, their root causes, the fixes applied to this repo, and
the verification steps used. Keep this updated as the setup evolves.

## TL;DR of fixes applied to this repo

| Issue | Root cause | Fix (file) |
|---|---|---|
| tmux config not loading / "looks messed up" | Attached to a **stale system tmux 1.8 server** while the client was brew tmux 3.6b → `protocol version mismatch (client 8, server 7)` | `zsh/zshenv` (new) activates Homebrew in **every** shell, incl. the non-interactive `ssh host "tmux ..."` command shell, so `tmux` resolves to the brew build. Symlinked via `setup.sh`. |
| Nerd Font glyphs render as `_` **only inside remote tmux** | tmux attached in **non-UTF-8 mode** (`client_utf8=0`) because SSH doesn't forward `LANG` and the ssh command shell had no locale | `zsh/zshenv` exports `LANG` (en_US.UTF-8 → C.UTF-8 fallback) for every shell; `zsh/aliases.zsh` launchers use `tmux -u` to force UTF-8. |
| Remote nvim yank doesn't reach Mac clipboard | OSC 52 chain — **last hop (local kitty) unconfirmed**; remote side verified working | `kitty/.config/kitty/kitty.conf` adds `clipboard_max_size 0`. **Open** — see below. |

---

## Issue 1 — tmux version mismatch (RESOLVED)

### Symptom
`tmux source-file` and most tmux commands errored with:
```
protocol version mismatch (client 8, server 7)
```
TERM had fallen back to `screen`; catppuccin/true-color/status formatting didn't render.

### Root cause
- Interactive shell's `tmux` → `/home/linuxbrew/.linuxbrew/bin/tmux` = **3.6b** ✅
- The **running server** (the one being attached to) → `/usr/bin/tmux` = **1.8** ❌

The `s()` / `t` aliases run `tmux new-session -A -s main`. When connecting via
`s host` = `ssh -t host "tmux new-session -A -s main"`, that command runs in a
**non-interactive, non-login** zsh, which reads only `~/.zshenv`. There was no
`~/.zshenv`, and Homebrew is activated in `zsh/tools.zsh` (sourced only by the
interactive `.zshrc`). So in the ssh-command context, linuxbrew was not on PATH
and `tmux` resolved to system **1.8** — that 1.8 process created the server.
Once attached, the interactive shell loaded brew, so a 3.6b *client* talked to a
1.8 *server* → mismatch.

### Fix
Created `zsh/zshenv` (symlinked to `~/.zshenv` by `setup.sh`) that runs
`brew shellenv` so every zsh invocation — including the ssh command shell —
finds the modern tmux.

### Verify
```bash
zsh -c 'command -v tmux; tmux -V'    # should be the linuxbrew path + 3.6b
tmux -V                              # 3.6b
```
To clear a stale server: `tmux kill-server`, then reconnect with `s host`.

---

## Issue 2 — Nerd Font glyphs show as `_` inside tmux (RESOLVED)

### Symptom
Icons (powerline separators, statusline glyphs) rendered as `_` / tofu **only
inside remote tmux**. Outside tmux (plain ssh shell, or local kitty) the same
glyphs rendered fine — proving the font is installed and kitty's `symbol_map`
works.

### Root cause
tmux was in **non-UTF-8 mode**: `tmux display -p '#{client_utf8}'` → `0`.
tmux decides UTF-8 mode from the attaching client's locale (`LC_ALL`/`LC_CTYPE`/
`LANG` containing "UTF-8") **or** the `-u` flag. The `s()` alias's ssh command
shell had **no `LANG`** (SSH doesn't forward it), so the tmux client attached
non-UTF-8 and drew every multibyte glyph as `_`.

Confirmed tmux was NOT corrupting bytes: a captured pane preserved the exact
UTF-8 bytes (`ee82b6` = U+E0B6, `f3b08a9a` = U+F029A). It was purely the
rendering-mode decision.

### Fix (belt-and-suspenders)
1. `zsh/zshenv` — export `LANG=en_US.UTF-8` (fallback `C.UTF-8`) if unset, so
   every shell (incl. the ssh command shell) has a UTF-8 locale.
2. `zsh/aliases.zsh` — `t` and `s()` now run `tmux -u ...` to force UTF-8 mode
   regardless of locale.

### Verify
```bash
# Fresh shell with no inherited locale should resolve UTF-8:
env -i HOME="$HOME" zsh -c 'source ~/.zshenv; echo "$LANG"'   # en_US.UTF-8
# After reconnecting with `s host` on a fresh server:
tmux display -p '#{client_utf8}'                              # 1
```
NOTE: an already-running server keeps its old UTF-8 state — must
`tmux kill-server` and reconnect for the change to take effect.

---

## Issue 3 — Remote nvim yank doesn't reach Mac clipboard (OPEN)

### Symptom
In remote nvim, `y` reports e.g. "18 lines yanked" but nothing lands in the Mac
clipboard. Local nvim (on the Mac, inside kitty) copies fine.

### Why local nvim working does NOT mean the bridge works
`nvim/.config/nvim/lua/zach/core/options.lua` gates the OSC 52 clipboard
provider behind `if vim.env.SSH_TTY`:
- **Local** nvim: no `SSH_TTY` → uses macOS `pbcopy` directly. Works, but
  exercises a different mechanism.
- **Remote** nvim: `SSH_TTY` set → uses **OSC 52** → tmux → ssh → kitty →
  macOS clipboard.

So local success is irrelevant to the remote OSC 52 path.

### The OSC 52 chain and what's verified
```
nvim (emits OSC 52)  →  tmux (set-clipboard on, intercepts)  →  ssh  →  kitty  →  macOS clipboard
        ✅ verified              ✅ verified                    direct    ❓ unconfirmed   ❓
```

Verified on the **remote** host:
- nvim selects the `OSC 52` provider in a real pane (`SSH_TTY` propagates).
- Under a real pty, nvim emits a valid sequence: `]52;c;<base64>` decoding back
  to the yanked text.
- tmux: `set-clipboard on`, `allow-passthrough on`, `client_utf8=1`, client
  advertises the `clipboard` termfeature (`xterm-kitty`).
- A raw OSC 52 emitted inside a pane is intercepted into tmux's paste buffer
  (`tmux show-buffer` shows it) → tmux is catching nvim's sequence and will
  re-forward to the outer terminal (kitty).

Connection is **kitty → ssh directly** (no jump host, no mosh), so nothing
between can swallow the sequence. That leaves the **local kitty hop** as the
only untested link.

### Mac-side facts gathered so far
- `kitty --version` → `kitty 0.47.4` (current).
- `~/.config/kitty/kitty.conf` on the Mac contains:
  `clipboard_control write-clipboard write-primary read-clipboard read-primary`
  (writes allowed — and allowed by default anyway).
- **Important:** the kitty config edits in THIS repo were made on the **remote**
  clone (`/local/home/zachhe/dot`). The Mac has its own clone; those edits have
  NOT reached it. The Mac's `kitty.conf` is what's actually in effect locally.
- A `printf '\033]52;c;aGVsbG8=\a'` test pasted "something old" — BUT it was
  likely run inside the remote tmux session (user always connects via `s host`),
  i.e. it actually exercised printf→tmux→kitty, not kitty alone. kitty-by-itself
  was never cleanly tested.

### Next tests to run — LOCALLY on the Mac (no ssh, no tmux)
Best run by a Claude instance on the Mac, or by hand. Open a fresh **local**
kitty window (`Cmd-N`) and stay local (do not `s host`).

1. kitty alone honors OSC 52 write?
   ```bash
   printf '\033]52;c;aGVsbG8=\a'    # aGVsbG8= = base64 "hello"
   pbpaste                          # expect: hello
   ```
2. kitty's own clipboard kitten (also OSC 52 under the hood):
   ```bash
   echo hello-kitten | kitty +kitten clipboard
   pbpaste                          # expect: hello-kitten
   ```
3. Running kitty's LOADED config (not just the file):
   ```bash
   kitty +runpy 'from kitty.fast_data_types import get_options; print("clipboard_control=", get_options().clipboard_control)'
   ```
4. macOS clipboard sanity:
   ```bash
   echo direct | pbcopy && pbpaste  # expect: direct
   ```
5. If step 1 fails but step 3 shows `write-clipboard`: the running kitty predates
   a config change. Full-quit kitty with **Cmd-Q** (note `clear_all_shortcuts yes`
   removes the reload shortcut), reopen, redo step 1.

### Interpreting results
- **Step 1 pastes `hello`** → kitty is fine; the break is **tmux→kitty
  forwarding** on the remote. Investigate there next.
- **Step 1 fails, step 2 works** → kitty reaches the clipboard but OSC 52 writes
  are disabled in the running process → restart loads the config.
- **Steps 1 & 2 both fail, step 4 works** → kitty drops OSC 52 writes (Mac-side
  kitty issue).
- **Step 4 fails** → macOS clipboard / permissions problem, unrelated to kitty.

To check the remote→tmux hop in isolation: yank in remote nvim, then on the
remote run `tmux show-buffer` — if it shows the yanked text, nvim→tmux works and
the break is downstream (tmux→kitty / local).

---

## Reference: the relevant config locations
- `zsh/zshenv` — PATH (brew) + `LANG` for ALL shells incl. ssh command shells.
- `zsh/aliases.zsh` — `t` / `s()` tmux launchers (now `tmux -u`).
- `zsh/tools.zsh` — brew activation for interactive shells.
- `tmux/.config/tmux/tmux.conf` — `set-clipboard on`, terminal-overrides/features.
- `nvim/.config/nvim/lua/zach/core/options.lua` — OSC 52 clipboard provider,
  gated on `SSH_TTY`.
- `kitty/.config/kitty/kitty.conf` — `symbol_map` (Nerd Font fallback),
  `clipboard_control`, `clipboard_max_size 0`.
- `setup.sh` — symlinks `~/.zshrc` and `~/.zshenv`; installs
  `font-symbols-only-nerd-font` cask on macOS.
