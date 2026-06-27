-- detect.lua — Find the Claude Code session belonging to a specific tmux pane.
--
-- Why this is non-trivial: a running Claude process is a 3-level tree
--   <toolbox wrapper> → bin/claude → claude   (the innermost is the real one)
-- and Claude writes its session file at ~/.claude/sessions/<innermost-pid>.json.
-- The OLD bash implementation did `pgrep claude` and took the FIRST match in
-- pid order — which is the OUTER wrapper, whose pid has no session file. That
-- made the pid→session lookup miss and silently fall back to "most recently
-- modified session", i.e. the wrong conversation whenever >1 Claude was running.
--
-- The fix here inverts the search: the session files ARE the source of truth
-- (each is named by the real claude pid), so we simply ask "which session-file
-- pid is a descendant of this pane?" Dead sessions self-exclude because `ps`
-- returns nothing for their pid. This is unambiguous per pane and needs no
-- pgrep at all.

local M = {}

local SESSIONS_DIR = vim.fn.expand("~/.claude/sessions")
local PROJECTS_DIR = vim.fn.expand("~/.claude/projects")
-- Safety bound on process-tree walks so a pathological/looping tree can't hang.
local MAX_TREE_DEPTH = 30

--- Return the parent pid of `pid`, or nil if it can't be determined.
---@param pid integer
---@return integer|nil
local function parent_pid(pid)
  local out = vim.fn.system({ "ps", "-o", "ppid=", "-p", tostring(pid) })
  if vim.v.shell_error ~= 0 then
    return nil
  end
  return tonumber((out:gsub("%s+", "")))
end

--- How many hops from `pid` up to `ancestor`, or nil if `ancestor` is not on
--- `pid`'s parent chain. 0 means pid == ancestor. Walking up (child→parent) is
--- unambiguous: every process has exactly one parent, so there is a single
--- path and the hop count is a true tree depth, unlike comparing raw pids.
---@param pid integer
---@param ancestor integer
---@return integer|nil depth
local function depth_below(pid, ancestor)
  local current = pid
  for hops = 0, MAX_TREE_DEPTH do
    if current == ancestor then
      return hops
    end
    local p = parent_pid(current)
    if not p or p <= 1 or p == current then
      return nil
    end
    current = p
  end
  return nil
end

--- Encode an absolute path the way Claude names its project directories:
--- every "/" becomes "-" (so "/Users/zach/dot" → "-Users-zach-dot").
---@param path string
---@return string
local function encode_project_dir(path)
  return (path:gsub("/", "-"))
end

--- Read and decode a Claude session JSON file.
---@param json_path string
---@return { session_id: string, cwd: string }|nil
local function read_session_json(json_path)
  if vim.fn.filereadable(json_path) == 0 then
    return nil
  end
  local ok, content = pcall(vim.fn.readfile, json_path)
  if not ok then
    return nil
  end
  local decoded_ok, data = pcall(vim.fn.json_decode, content)
  if not decoded_ok or type(data) ~= "table" or not data.sessionId then
    return nil
  end
  return { session_id = data.sessionId, cwd = data.cwd or "" }
end

--- Resolve a session's conversation JSONL transcript. The transcript lives at
--- projects/<encoded-cwd>/<session_id>.jsonl; we try the session's own cwd
--- first, then the pane cwd as a fallback (they normally match).
---@param session_id string
---@param session_cwd string
---@param pane_cwd string|nil
---@return string|nil
local function resolve_conversation(session_id, session_cwd, pane_cwd)
  for _, cwd in ipairs({ session_cwd, pane_cwd }) do
    if cwd and cwd ~= "" then
      local candidate =
        ("%s/%s/%s.jsonl"):format(PROJECTS_DIR, encode_project_dir(cwd), session_id)
      if vim.fn.filereadable(candidate) == 1 then
        return candidate
      end
    end
  end
  return nil
end

--- Find the Claude session that belongs to a given tmux pane.
---
--- Scans ~/.claude/sessions/*.json (each named by a live claude pid) and keeps
--- the ones whose pid is a descendant of `pane_pid`. In the normal case exactly
--- one matches. If more than one matches (e.g. a nested `claude` launched from
--- within another), the deepest pid in the tree is the foreground session.
---@param pane_pid integer
---@param pane_cwd string|nil  Used as a fallback when resolving the transcript.
---@return { pid: integer, session_id: string, cwd: string, conversation: string }|nil session
---@return integer match_count  How many sessions matched this pane (for UX/diagnostics).
function M.find_session_for_pane(pane_pid, pane_cwd)
  if not pane_pid then
    return nil, 0
  end

  if vim.fn.isdirectory(SESSIONS_DIR) == 0 then
    return nil, 0
  end

  -- Gather candidate sessions: file pid descends from the pane AND the
  -- transcript exists. Track tree-depth so we can prefer the innermost.
  local candidates = {}
  for name, type_ in vim.fs.dir(SESSIONS_DIR) do
    local pid_str = type_ == "file" and name:match("^(%d+)%.json$")
    local pid = pid_str and tonumber(pid_str)
    local depth = pid and depth_below(pid, pane_pid)
    if depth then
      local info = read_session_json(SESSIONS_DIR .. "/" .. name)
      if info then
        local conversation =
          resolve_conversation(info.session_id, info.cwd, pane_cwd)
        if conversation then
          table.insert(candidates, {
            pid = pid,
            depth = depth,
            session_id = info.session_id,
            cwd = info.cwd,
            conversation = conversation,
          })
        end
      end
    end
  end

  if #candidates == 0 then
    return nil, 0
  end

  -- Prefer the deepest process (innermost/foreground claude in this pane).
  table.sort(candidates, function(a, b)
    return a.depth > b.depth
  end)

  return candidates[1], #candidates
end

return M
