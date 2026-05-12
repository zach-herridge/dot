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


def get_claude_pid(foreground_processes):
    """Get the PID of a running Claude Code foreground process."""
    for fp in (foreground_processes or []):
        cmdline = fp.get("cmdline", [])
        if not cmdline:
            continue
        name = cmdline[0].split("/")[-1]
        if name == "claude":
            return fp.get("pid")
        if name == "node" and any("claude" in a for a in cmdline[1:]):
            return fp.get("pid")
    return None


def conversation_from_session(session_path, fallback_cwd=None):
    """Given a session JSON file, resolve the conversation JSONL path."""
    if not session_path or not os.path.exists(session_path):
        return None
    try:
        with open(session_path) as f:
            session = json.load(f)
    except Exception:
        return None

    session_id = session.get("sessionId")
    session_cwd = session.get("cwd", "")
    if not session_id:
        return None

    for try_cwd in [session_cwd, fallback_cwd]:
        if not try_cwd:
            continue
        encoded = try_cwd.replace("/", "-")
        conv_file = os.path.expanduser(
            f"~/.claude/projects/{encoded}/{session_id}.jsonl"
        )
        if os.path.exists(conv_file):
            return conv_file

    return None


def find_claude_conversation(cwd, claude_pid=None):
    """Find the Claude conversation file for the current tab.

    Uses a tiered strategy to correctly identify which conversation belongs
    to this specific terminal tab, even with multiple Claude instances:

      1. Direct PID->session lookup (exact match, O(1))
      2. Walk process tree upward (handles child-of-claude edge case)
      3. CWD-scoped most recent JSONL (handles stale/missing session files)
      4. Global fallback (original behavior, last resort)
    """
    sessions_dir = os.path.expanduser("~/.claude/sessions")

    # Strategy 1: Direct PID -> session file (session files are named {pid}.json)
    if claude_pid:
        session_path = os.path.join(sessions_dir, f"{claude_pid}.json")
        conv = conversation_from_session(session_path, cwd)
        if conv:
            return conv

        # Strategy 2: Walk process tree upward to find ancestor with session file
        import subprocess

        try:
            r = subprocess.run(
                ["ps", "-eo", "pid=,ppid="], capture_output=True, text=True
            )
            parent_of = {}
            for line in r.stdout.splitlines():
                parts = line.split()
                if len(parts) == 2:
                    parent_of[parts[0]] = parts[1]

            current = str(claude_pid)
            for _ in range(10):
                parent = parent_of.get(current)
                if not parent or parent in ("0", "1", current):
                    break
                session_path = os.path.join(sessions_dir, f"{parent}.json")
                conv = conversation_from_session(session_path, cwd)
                if conv:
                    return conv
                current = parent
        except Exception:
            pass

    # Strategy 3: Most recent JSONL in the CWD-scoped project directory
    if cwd:
        encoded = cwd.replace("/", "-")
        project_dir = os.path.expanduser(f"~/.claude/projects/{encoded}")
        if os.path.isdir(project_dir):
            best_path = None
            best_mtime = 0
            for name in os.listdir(project_dir):
                if not name.endswith(".jsonl"):
                    continue
                path = os.path.join(project_dir, name)
                mtime = os.path.getmtime(path)
                if mtime > best_mtime:
                    best_mtime = mtime
                    best_path = path
            if best_path:
                return best_path

    # Strategy 4: Global fallback - most recent session file
    if not os.path.isdir(sessions_dir):
        return None

    best_session = None
    best_mtime = 0
    for name in os.listdir(sessions_dir):
        if not name.endswith(".json"):
            continue
        path = os.path.join(sessions_dir, name)
        mtime = os.path.getmtime(path)
        if mtime > best_mtime:
            best_mtime = mtime
            best_session = path

    return conversation_from_session(best_session, cwd)


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

    claude_pid = get_claude_pid(foreground)
    if claude_pid:
        cwd = w.child.foreground_cwd or ""
        conv = find_claude_conversation(cwd, claude_pid)
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
