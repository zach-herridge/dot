from kitty.boss import Boss
from kittens.tui.handler import result_handler

def main(args):
    pass

@result_handler(type_of_input=None, no_ui=True, has_ready_notification=False)
def handle_result(args, result, target_window_id: int, boss: Boss) -> None:
    w = boss.window_id_map.get(target_window_id)
    if not w:
        return
    
    # Check foreground processes
    for fp in (w.child.foreground_processes or []):
        cmdline = fp.get("cmdline", [])
        name = cmdline[0].split("/")[-1] if cmdline else ""
        if name in ("nvim", "vim", "vi"):
            w.write_to_child(b"\x15")
            return
    
    # Fallback: single ps call, walk tree in memory
    import subprocess
    try:
        r = subprocess.run(["ps", "-eo", "pid=,ppid=,comm="], capture_output=True, text=True)
        procs = {}
        for line in r.stdout.splitlines():
            parts = line.split(None, 2)
            if len(parts) == 3:
                procs[parts[0]] = (parts[1], parts[2].split("/")[-1])
        
        def has_vim(pid, depth=0):
            if depth > 5: return False
            for cpid, (ppid, comm) in procs.items():
                if ppid == str(pid):
                    if comm in ("nvim", "vim", "vi"):
                        return True
                    if has_vim(cpid, depth + 1):
                        return True
            return False
        
        if has_vim(w.child.pid):
            w.write_to_child(b"\x15")
            return
    except:
        pass
    
    boss.call_remote_control(w, ("kitten", "~/.local/share/nvim/lazy/kitty-scrollback.nvim/python/kitty_scrollback_nvim.py"))
