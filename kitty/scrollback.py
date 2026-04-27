from kitty.boss import Boss
from kittens.tui.handler import result_handler
from kitty.utils import which

import json
import os
import tempfile


def main(args):
    pass


def is_vim_running(w):
    """Check if vim/nvim is a foreground process or in the process tree."""
    for fp in (w.child.foreground_processes or []):
        cmdline = fp.get("cmdline", [])
        name = cmdline[0].split("/")[-1] if cmdline else ""
        if name in ("nvim", "vim", "vi"):
            return True

    # Fallback: walk process tree
    import subprocess

    try:
        r = subprocess.run(
            ["ps", "-eo", "pid=,ppid=,comm="], capture_output=True, text=True
        )
        procs = {}
        for line in r.stdout.splitlines():
            parts = line.split(None, 2)
            if len(parts) == 3:
                procs[parts[0]] = (parts[1], parts[2].split("/")[-1])

        def has_vim(pid, depth=0):
            if depth > 5:
                return False
            for cpid, (ppid, comm) in procs.items():
                if ppid == str(pid):
                    if comm in ("nvim", "vim", "vi"):
                        return True
                    if has_vim(cpid, depth + 1):
                        return True
            return False

        return has_vim(w.child.pid)
    except Exception:
        return False


def is_claude_running(foreground_processes):
    """Check if Claude Code is a foreground process."""
    for fp in (foreground_processes or []):
        cmdline = fp.get("cmdline", [])
        if not cmdline:
            continue
        name = cmdline[0].split("/")[-1]
        if name == "claude":
            return True
        if name == "node" and any("claude" in a for a in cmdline[1:]):
            return True
    return False


def find_claude_conversation(cwd):
    """Find the most recent Claude conversation file for a working directory."""
    sessions_dir = os.path.expanduser("~/.claude/sessions")
    if not os.path.isdir(sessions_dir):
        return None

    # Find most recent session file
    best_path = None
    best_mtime = 0
    for name in os.listdir(sessions_dir):
        if not name.endswith(".json"):
            continue
        path = os.path.join(sessions_dir, name)
        mtime = os.path.getmtime(path)
        if mtime > best_mtime:
            best_mtime = mtime
            best_path = path

    if not best_path:
        return None

    with open(best_path) as f:
        session = json.load(f)

    session_id = session.get("sessionId")
    session_cwd = session.get("cwd", "")
    if not session_id or not session_cwd:
        return None

    # Try session's own cwd first, then the passed cwd
    for try_cwd in [session_cwd, cwd]:
        if not try_cwd:
            continue
        encoded = try_cwd.replace("/", "-")
        conv_file = os.path.expanduser(
            f"~/.claude/projects/{encoded}/{session_id}.jsonl"
        )
        if os.path.exists(conv_file):
            return conv_file

    return None


@result_handler(type_of_input=None, no_ui=True, has_ready_notification=False)
def handle_result(args, result, target_window_id: int, boss: Boss) -> None:
    check_vim = "--check-vim" in args

    w = boss.window_id_map.get(target_window_id)
    if not w:
        return

    # If --check-vim and vim is running, send Ctrl+U instead
    if check_vim and is_vim_running(w):
        w.write_to_child(b"\x15")
        return

    kitty_path = which("kitty")
    nvim_path = which("nvim")
    if not kitty_path or not nvim_path:
        return

    # Detect mode
    foreground = w.child.foreground_processes or []
    mode = "scrollback"
    conversation_file = None

    if is_claude_running(foreground):
        cwd = w.child.foreground_cwd or ""
        conv = find_claude_conversation(cwd)
        if conv:
            mode = "claude"
            conversation_file = conv

    # Collect data
    data = {
        "mode": mode,
        "window_id": int(target_window_id),
        "kitty_path": kitty_path,
        "scrolled_by": w.screen.scrolled_by,
        "cursor_x": w.screen.cursor.x + 1,
        "cursor_y": w.screen.cursor.y + 1,
        "lines": w.screen.lines + 1,
        "columns": w.screen.columns,
    }
    if conversation_file:
        data["conversation_file"] = conversation_file

    # Write data to temp file (avoids all escaping issues)
    fd, tmp_path = tempfile.mkstemp(suffix=".json", prefix="ksb_")
    with os.fdopen(fd, "w") as f:
        json.dump(data, f)

    # CWD for the overlay
    cwd = w.child.foreground_cwd
    cwd_args = ("--cwd", cwd) if cwd else ()

    # Build nvim launch: VimEnter reads temp file and launches plugin
    lua_code = (
        " lua"
        " vim.api.nvim_create_autocmd('VimEnter', {"
        "   group = vim.api.nvim_create_augroup('KsbVimEnter', { clear = true }),"
        "   once = true,"
        "   callback = function()"
        "     vim.api.nvim_exec_autocmds('User',"
        "       { pattern = 'KittyScrollbackLaunch', modeline = false })"
        "     local f = io.open([=[" + tmp_path + "]=], 'r')"
        "     if f then"
        "       local s = f:read('*a')"
        "       f:close()"
        "       os.remove([=[" + tmp_path + "]=])"
        "       require('zach.kitty-scrollback').launch(s)"
        "     end"
        "   end,"
        " })"
    )

    cmd = (
        "launch",
        "--copy-env",
        "--type",
        "overlay",
        "--title",
        "kitty-scrollback",
    ) + cwd_args + (
        nvim_path,
        "--cmd",
        lua_code,
    )

    boss.call_remote_control(w, cmd)
