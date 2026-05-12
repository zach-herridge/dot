local M = {}

-- Handles both normal repos (.git directory) and worktrees (.git file)
local function is_git_repo(path)
  return vim.fn.isdirectory(path .. "/.git") == 1
    or vim.fn.filereadable(path .. "/.git") == 1
end

local function is_brazil_workspace(path)
  return vim.fn.filereadable(path .. "/packageInfo") == 1
end

local function scan_directory(dir, callback)
  local handle = vim.uv.fs_scandir(dir)
  if not handle then return end

  while true do
    local name, type = vim.uv.fs_scandir_next(handle)
    if not name then break end
    if type == "directory" then
      callback(dir .. "/" .. name)
    end
  end
end

function M.find_git_root()
  local current_file = vim.fn.expand("%:p")

  -- Start from current file's directory if available
  if current_file ~= "" then
    local dir = vim.fn.fnamemodify(current_file, ":h")
    while dir ~= "/" do
      if is_git_repo(dir) then
        return dir
      end
      dir = vim.fn.fnamemodify(dir, ":h")
    end
  end

  -- Fallback to cwd
  local cwd = vim.fn.getcwd()
  if is_brazil_workspace(cwd) then
    -- Find first git repo in src/
    local src_dir = cwd .. "/src"
    if vim.fn.isdirectory(src_dir) == 1 then
      local git_root = nil
      scan_directory(src_dir, function(package_path)
        if not git_root and is_git_repo(package_path) then
          git_root = package_path
        end
      end)
      return git_root
    end
  end

  return cwd
end

function M.find_all_git_roots()
  local repos = {}
  local current = vim.fn.getcwd()

  if is_brazil_workspace(current) then
    -- Brazil workspace - scan src directory
    local src_dir = current .. "/src"
    if vim.fn.isdirectory(src_dir) == 1 then
      scan_directory(src_dir, function(package_path)
        if is_git_repo(package_path) then
          table.insert(repos, package_path)
        end
      end)
    end

    -- Check workspace root
    if is_git_repo(current) then
      table.insert(repos, current)
    end
  else
    -- Walk up directory tree
    while current ~= "/" do
      if is_git_repo(current) then
        table.insert(repos, current)
        break
      end
      local parent = vim.fn.fnamemodify(current, ":h")
      if parent == current then break end
      current = parent
    end
  end

  table.sort(repos)
  return repos
end

--- Open a snacks picker scoped to git repo(s).
--- Uses Snacks.picker.pick() uniformly so both built-in sources (files, grep)
--- and custom sources (grep_word, grep_all) work correctly.
---
--- @param source string   Picker source name (e.g. "files", "grep", "grep_word")
--- @param opts   table?   Options passed to the picker. The special key `fallback`
---                         (string) is consumed here and not forwarded to snacks.
function M.git_picker(source, opts)
  opts = opts or {}
  local repos = M.find_all_git_roots()

  -- Strip internal-only keys before passing to snacks
  local clean_opts = vim.tbl_deep_extend("force", {}, opts)
  clean_opts.fallback = nil

  if #repos == 1 then
    clean_opts.cwd = repos[1]
    return Snacks.picker.pick(source, clean_opts)
  elseif #repos > 1 then
    -- Multi-repo: create one sub-source per repo
    local multi = vim.tbl_map(function(repo)
      return vim.tbl_extend("force", { source = source, cwd = repo }, clean_opts)
    end, repos)

    -- Build top-level opts; "keep" so multi/format aren't clobbered
    local pick_opts = vim.tbl_extend("keep", {
      multi = multi,
      format = "file",
    }, clean_opts)

    if source:match("grep") then
      pick_opts.live = true
      pick_opts.supports_live = true
    end

    return Snacks.picker.pick(pick_opts)
  else
    -- No repos found -- fall back
    local fallback = opts.fallback or source
    return Snacks.picker.pick(fallback, clean_opts)
  end
end

return M
