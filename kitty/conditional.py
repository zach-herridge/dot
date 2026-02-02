from kitty.boss import Boss
from kittens.tui.handler import result_handler

def main(args):
    pass

@result_handler(type_of_input=None, no_ui=True, has_ready_notification=False)
def handle_result(args, result, target_window_id: int, boss: Boss) -> None:
    w = boss.window_id_map.get(target_window_id)
    if not w:
        return
    fp = (w.child.foreground_processes or [{}])[0]
    cmdline = fp.get("cmdline", [])
    name = cmdline[0].split("/")[-1] if cmdline else ""
    
    if name in ("nvim", "vim", "vi"):
        w.write_to_child(b"\x15")
    else:
        boss.call_remote_control(w, ("kitten", "~/.local/share/nvim/lazy/kitty-scrollback.nvim/python/kitty_scrollback_nvim.py"))
