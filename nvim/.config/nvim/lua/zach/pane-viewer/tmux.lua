-- tmux.lua — Thin wrappers around the tmux CLI used by the pane viewer.
--
-- The viewer runs inside a `tmux popup`, which is itself a tmux client, so it
-- can query and capture the ORIGINATING pane directly — no data needs to be
-- marshalled in from the shell script. The pane id is passed via $ZACH_PV_PANE.

local M = {}

--- Run a tmux command and return trimmed stdout, or nil on failure.
---@param args string[]
---@return string|nil
local function tmux(args)
  local cmd = { "tmux" }
  vim.list_extend(cmd, args)
  local out = vim.fn.system(cmd)
  if vim.v.shell_error ~= 0 then
    return nil
  end
  return (out:gsub("%s+$", ""))
end

--- Query a single tmux format string against a pane (e.g. "#{pane_pid}").
---@param pane_id string
---@param format string
---@return string|nil
function M.pane_var(pane_id, format)
  return tmux({ "display-message", "-p", "-t", pane_id, format })
end

--- Capture a pane's visible content + scrollback, preserving SGR color escapes
--- (-e) so baleia can turn them into highlights. `lines` caps how far back we
--- reach (negative start line). Returns an array of lines.
---@param pane_id string
---@param lines integer  Number of scrollback lines to reach back (e.g. 10000).
---@return string[]
function M.capture_scrollback(pane_id, lines)
  local out = vim.fn.system({
    "tmux",
    "capture-pane",
    "-t",
    pane_id,
    "-p", -- print to stdout
    "-e", -- include escape sequences (colors)
    "-S",
    tostring(-math.abs(lines)), -- start N lines into history
  })
  if vim.v.shell_error ~= 0 then
    return {}
  end
  return vim.split(out, "\n")
end

return M
