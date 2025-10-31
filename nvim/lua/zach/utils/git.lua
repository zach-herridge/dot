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

return M
