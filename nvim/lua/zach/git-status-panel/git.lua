local M = {}

function M.find_repos()
  local repos = {}
  local current = vim.fn.getcwd()
  
  -- Check if we're in a Brazil workspace
  if vim.fn.filereadable(current .. "/packageInfo") == 1 then
    -- Brazil workspace - check src directory for packages
    local src_dir = current .. "/src"
    if vim.fn.isdirectory(src_dir) == 1 then
      local handle = vim.loop.fs_scandir(src_dir)
      if handle then
        while true do
          local name, type = vim.loop.fs_scandir_next(handle)
          if not name then break end
          
          if type == "directory" then
            local package_path = src_dir .. "/" .. name
            -- Check if this package directory has a git repo
            if vim.fn.isdirectory(package_path .. "/.git") == 1 then
              table.insert(repos, package_path)
            end
          end
        end
      end
    end
    
    -- Also check if the workspace root itself is a git repo
    if vim.fn.isdirectory(current .. "/.git") == 1 then
      table.insert(repos, current)
    end
  else
    -- Regular single repo - walk up the directory tree
    while current ~= "/" do
      if vim.fn.isdirectory(current .. "/.git") == 1 then
        table.insert(repos, current)
        break
      end
      
      local parent = vim.fn.fnamemodify(current, ":h")
      if parent == current then break end
      current = parent
    end
  end
  
  -- Sort repos by path for stable order
  table.sort(repos)
  return repos
end

function M.get_status_for_repos(repos, callback)
  local status_data = {}
  local pending = #repos
  
  if pending == 0 then
    callback(status_data)
    return
  end
  
  for _, repo in ipairs(repos) do
    local repo_name = vim.fn.fnamemodify(repo, ":t")
    
    M.get_changed_files(repo, function(files, branch)
      if #files > 0 then
        status_data[repo_name] = {
          path = repo,
          files = files,
          branch = branch
        }
      end
      
      pending = pending - 1
      if pending == 0 then
        -- All git commands completed, now update once
        callback(status_data)
      end
    end)
  end
end

function M.get_changed_files(repo_path, callback)
  local cmd = { "git", "status", "--porcelain" }
  local branch_cmd = { "git", "branch", "--show-current" }
  
  -- Get branch name first
  vim.system(branch_cmd, { cwd = repo_path }, function(branch_result)
    local branch = "unknown"
    if branch_result.code == 0 and branch_result.stdout then
      branch = branch_result.stdout:gsub("\n", "")
    end
    
    -- Then get file status
    vim.system(cmd, { cwd = repo_path }, function(result)
      local files = {}
      
      if result.code == 0 and result.stdout then
        for line in result.stdout:gmatch("[^\r\n]+") do
          local status = line:sub(1, 2)
          local file = line:sub(4)
          
          table.insert(files, {
            status = status,
            file = file,
            full_path = repo_path .. "/" .. file,
          })
        end
      end
      
      -- Sort files by path for stable order
      table.sort(files, function(a, b) return a.file < b.file end)
      
      vim.schedule(function()
        callback(files, branch)
      end)
    end)
  end)
end

return M
