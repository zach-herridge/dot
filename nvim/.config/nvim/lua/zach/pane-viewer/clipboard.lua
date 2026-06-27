-- clipboard.lua — Make yanks inside the popup reach the system clipboard.
--
-- A `tmux popup` (unlike a normal pane) does NOT relay a child program's OSC 52
-- out to the host terminal: tmux's set-clipboard interception only applies to
-- panes, and DCS passthrough from a popup is silently dropped. So nvim's default
-- OSC 52 provider yanks into the register but the escape never reaches the Mac
-- clipboard.
--
-- Fix: hand the data to the tmux SERVER via `tmux load-buffer -w -`. The `-w`
-- flag makes tmux itself emit the OSC 52 to its attached client (the terminal)
-- from OUTSIDE the popup, so the popup boundary is irrelevant. Requires
-- `set-clipboard on` (tmux.conf sets it). `load-buffer` reads data from stdin
-- (`-`), avoiding argv length/escaping limits on large yanks.

local M = {}

--- Install a vim.g.clipboard provider that routes copies through tmux's server.
--- No-op (returns false) when not running inside tmux.
---@return boolean installed
function M.install()
  if not vim.env.TMUX or vim.env.TMUX == "" then
    return false
  end

  local function copy(_)
    return function(lines)
      local payload = table.concat(lines, "\n")
      -- Synchronous: an async jobstart can be torn down when the viewer quits
      -- right after the yank, before the data is flushed. system() with the
      -- payload on stdin both blocks until done and avoids shell quoting.
      vim.fn.system({ "tmux", "load-buffer", "-w", "-" }, payload)
    end
  end

  local function paste(reg)
    return function()
      return vim.split(vim.fn.getreg(reg), "\n"), vim.fn.getregtype(reg)
    end
  end

  vim.g.clipboard = {
    name = "tmux-load-buffer",
    copy = { ["+"] = copy("+"), ["*"] = copy("*") },
    paste = { ["+"] = paste("+"), ["*"] = paste("*") },
  }
  return true
end

return M
