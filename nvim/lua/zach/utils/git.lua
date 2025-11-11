local M = {}

function M.find_git_root()
  local current_file = vim.fn.expand("%:p")
  local git_root = nil
  
  if current_file ~= "" then
    -- Start from current file's directory
    local dir = vim.fn.fnamemodify(current_file, ":h")
    while dir ~= "/" do
      if vim.fn.isdirectory(dir .. "/.git") == 1 then
        git_root = dir
        break
      end
      dir = vim.fn.fnamemodify(dir, ":h")
    end
  end
  
  -- Fallback to cwd if no git repo found from current file
  if not git_root then
    local cwd = vim.fn.getcwd()
    -- Check if we're in a Brazil workspace
    if vim.fn.filereadable(cwd .. "/packageInfo") == 1 then
      -- Try to find a git repo in src/ directory
      local src_dir = cwd .. "/src"
      if vim.fn.isdirectory(src_dir) == 1 then
        local handle = vim.loop.fs_scandir(src_dir)
        if handle then
          while true do
            local name, type = vim.loop.fs_scandir_next(handle)
            if not name then break end
            if type == "directory" then
              local package_path = src_dir .. "/" .. name
              if vim.fn.isdirectory(package_path .. "/.git") == 1 then
                git_root = package_path
                break
              end
            end
          end
        end
      end
    else
      -- Regular single repo
      git_root = cwd
    end
  end
  
  return git_root
end

function M.find_all_git_roots()
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
  
  table.sort(repos)
  return repos
end

function M.get_all_git_files_sync()
  local repos = M.find_all_git_roots()
  if #repos == 0 then
    return {}
  end
  
  local all_files = {}
  local workspace_root = vim.fn.getcwd()
  
  for _, repo in ipairs(repos) do
    local cmd = { "git", "ls-files", "--exclude-standard", "--cached" }
    local result = vim.system(cmd, { cwd = repo }):wait()
    
    if result.code == 0 and result.stdout then
      for line in result.stdout:gmatch("[^\r\n]+") do
        if line and line ~= "" then
          -- Make path relative to workspace root
          local relative_path = repo:gsub("^" .. workspace_root .. "/", "") .. "/" .. line
          -- Ensure it's a string, not a table
          if type(relative_path) == "string" then
            table.insert(all_files, relative_path)
          end
        end
      end
    end
  end
  
  table.sort(all_files)
  -- Debug: print first few files to see format
  for i = 1, math.min(3, #all_files) do
    print("File " .. i .. ": " .. vim.inspect(all_files[i]))
  end
  return all_files
end

return M
