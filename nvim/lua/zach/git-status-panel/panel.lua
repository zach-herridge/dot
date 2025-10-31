local M = {}

local buf = nil
local win = nil
local line_data = {} -- Store complete file data by line number

function M.is_open()
  return win and vim.api.nvim_win_is_valid(win) and vim.api.nvim_buf_is_valid(buf)
end

function M.toggle(config)
  if M.is_open() then
    M.close()
  else
    M.open(config)
  end
end

function M.open(config)
  -- Create vertical split
  vim.cmd("vsplit")
  
  -- Create buffer
  buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_option(buf, "bufhidden", "wipe")
  vim.api.nvim_buf_set_option(buf, "buftype", "nofile")
  vim.api.nvim_buf_set_option(buf, "swapfile", false)
  vim.api.nvim_buf_set_option(buf, "filetype", "git-status-panel")
  
  -- Set buffer in current window
  win = vim.api.nvim_get_current_win()
  vim.api.nvim_win_set_buf(win, buf)
  
  -- Resize split
  vim.cmd("vertical resize " .. config.window.width)
  
  -- Set window options
  vim.api.nvim_win_set_option(win, "wrap", false)
  vim.api.nvim_win_set_option(win, "cursorline", true)
  
  -- Set up keymaps
  M.setup_keymaps()
  
  -- Initial refresh
  require("zach.git-status-panel").refresh()
end

function M.close()
  if win and vim.api.nvim_win_is_valid(win) then
    vim.api.nvim_win_close(win, true)
  end
  win = nil
  buf = nil
end

function M.setup_keymaps()
  local opts = { buffer = buf, silent = true }
  
  -- Close panel
  vim.keymap.set("n", "q", M.close, opts)
  vim.keymap.set("n", "<Esc>", M.close, opts)
  
  -- Open file under cursor
  vim.keymap.set("n", "<CR>", M.open_file, opts)
  vim.keymap.set("n", "o", M.open_file, opts)
  
  -- Stage/unstage file
  vim.keymap.set("n", "<Tab>", M.toggle_stage, opts)
  
  -- Revert changes
  vim.keymap.set("n", "r", M.revert_file, opts)
  
  -- Delete file
  vim.keymap.set("n", "d", M.delete_file, opts)
  
  -- Show diff
  vim.keymap.set("n", "p", M.show_diff, opts)
  
  -- Refresh
  vim.keymap.set("n", "R", function()
    require("zach.git-status-panel").refresh()
  end, opts)
end

function M.update(status_data, unstaged_only)
  if not buf or not vim.api.nvim_buf_is_valid(buf) then
    return
  end
  
  -- Make buffer modifiable before updating
  vim.api.nvim_buf_set_option(buf, "modifiable", true)
  
  local lines = {}
  line_data = {} -- Reset line data
  local line_num = 1
  
  -- Get current file for highlighting
  local current_file = vim.fn.expand("%:p")
  local cwd = vim.fn.getcwd()
  local current_relative = current_file:gsub("^" .. cwd .. "/", "")
  
  -- Create title with branch info for single repo
  local title = unstaged_only and "Git Status (Unstaged)" or "Git Status"
  if vim.tbl_count(status_data) == 1 then
    local _, repo_data = next(status_data)
    if repo_data.branch then
      title = title .. " [" .. repo_data.branch .. "]"
    end
  end
  
  table.insert(lines, title)
  table.insert(lines, string.rep("-", #title))
  table.insert(lines, "")
  line_num = line_num + 3
  
  if vim.tbl_isempty(status_data) then
    table.insert(lines, "No changes")
  else
    -- Sort repo names for stable order
    local sorted_repos = {}
    for repo_name, _ in pairs(status_data) do
      table.insert(sorted_repos, repo_name)
    end
    table.sort(sorted_repos)
    
    for _, repo_name in ipairs(sorted_repos) do
      local repo_data = status_data[repo_name]
      
      -- Show repo/package name with branch if multiple repos
      if vim.tbl_count(status_data) > 1 then
        local header = "[" .. repo_name .. "]"
        if repo_data.branch then
          header = header .. " (" .. repo_data.branch .. ")"
        end
        table.insert(lines, header)
        line_num = line_num + 1
      end
      
      for _, file_data in ipairs(repo_data.files) do
        -- Filter for unstaged changes if requested
        if not unstaged_only or file_data.status:sub(2, 2) ~= " " then
          local filename = vim.fn.fnamemodify(file_data.file, ":t")
          local indicator = file_data.file == current_relative and ">" or " "
          table.insert(lines, file_data.status .. indicator .. filename)
          
          -- Store complete file data for this line
          line_data[line_num] = {
            file = file_data.file,
            full_path = file_data.full_path,
            status = file_data.status,
            repo_path = repo_data.path
          }
          line_num = line_num + 1
        end
      end
      
      -- Add spacing between repos if multiple
      if vim.tbl_count(status_data) > 1 then
        table.insert(lines, "")
        line_num = line_num + 1
      end
    end
  end
  
  -- Add cheatsheet at bottom
  table.insert(lines, "")
  table.insert(lines, "Cheatsheet:")
  table.insert(lines, "M  = Modified")
  table.insert(lines, "A  = Added")
  table.insert(lines, "D  = Deleted")
  table.insert(lines, "R  = Renamed")
  table.insert(lines, "C  = Copied")
  table.insert(lines, "?? = Untracked")
  table.insert(lines, "MM = Modified (staged + unstaged)")
  table.insert(lines, "AM = Added + modified")
  
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.api.nvim_buf_set_option(buf, "modifiable", false)
end

function M.open_file()
  local line_num = vim.api.nvim_win_get_cursor(0)[1]
  local data = line_data[line_num]
  
  if data then
    vim.cmd("wincmd p") -- Go to previous window
    vim.cmd("edit " .. vim.fn.fnameescape(data.full_path))
  end
end

function M.delete_file()
  local line_num = vim.api.nvim_win_get_cursor(0)[1]
  local data = line_data[line_num]
  
  if not data then
    return
  end
  
  -- Confirmation prompt
  local choice = vim.fn.confirm("Delete " .. data.file .. "?", "&Yes\n&No", 2)
  if choice ~= 1 then
    return
  end
  
  local success = vim.fn.delete(data.full_path)
  
  if success == 0 then
    require("zach.git-status-panel").refresh()
  else
    vim.notify("Failed to delete " .. data.file, vim.log.levels.ERROR)
  end
end

function M.revert_file()
  local line_num = vim.api.nvim_win_get_cursor(0)[1]
  local data = line_data[line_num]
  
  if not data or not data.repo_path then
    return
  end
  
  -- Confirmation prompt
  local choice = vim.fn.confirm("Revert changes to " .. data.file .. "?", "&Yes\n&No", 2)
  if choice ~= 1 then
    return
  end
  
  local cmd = { "git", "checkout", "HEAD", "--", data.file }
  
  vim.system(cmd, { cwd = data.repo_path }, function(result)
    vim.schedule(function()
      if result.code == 0 then
        require("zach.git-status-panel").refresh()
      else
        vim.notify("Failed to revert " .. data.file, vim.log.levels.ERROR)
      end
    end)
  end)
end

function M.toggle_stage()
  local line_num = vim.api.nvim_win_get_cursor(0)[1]
  local data = line_data[line_num]
  
  if not data or not data.repo_path then
    return
  end
  
  local cmd
  -- Check if file has unstaged changes (second character is not space)
  if data.status:sub(2, 2) ~= " " then
    -- Stage unstaged changes
    cmd = { "git", "add", data.file }
  else
    -- Unstage (only if first character shows staged changes)
    cmd = { "git", "reset", "HEAD", data.file }
  end
  
  vim.system(cmd, { cwd = data.repo_path }, function(result)
    vim.schedule(function()
      if result.code == 0 then
        require("zach.git-status-panel").refresh()
      end
    end)
  end)
end

function M.show_diff()
  local line_num = vim.api.nvim_win_get_cursor(0)[1]
  local data = line_data[line_num]
  
  if not data or not data.repo_path then
    return
  end
  
  -- Calculate relative path from repo root
  local relative_path = data.full_path:gsub("^" .. data.repo_path .. "/", "")
  
  -- Close any existing diffview first
  pcall(function() vim.cmd("DiffviewClose") end)
  
  -- Use diffview.open() like the command does
  local diffview = require("diffview")
  
  -- Create args array like the command would
  local args = {
    "-C" .. data.repo_path,
    "HEAD",
    "--",
    relative_path
  }
  
  -- Call diffview.open() like the command does
  diffview.open(args)
  
  -- Hide file panel after diffview opens
  vim.defer_fn(function()
    vim.cmd("DiffviewToggleFiles")
  end, 200)
end

function M.jump_to_next_file()
  local current_file = vim.fn.expand("%:p")
  local cwd = vim.fn.getcwd()
  local relative_path = current_file:gsub("^" .. cwd .. "/", "")
  
  -- Find current file in the list
  local current_index = nil
  local file_list = {}
  
  for line_num, data in pairs(line_data) do
    table.insert(file_list, {line_num = line_num, path = data.file, full_path = data.full_path})
    if data.file == relative_path then
      current_index = #file_list
    end
  end
  
  -- Sort by line number
  table.sort(file_list, function(a, b) return a.line_num < b.line_num end)
  
  if current_index and current_index < #file_list then
    local next_file = file_list[current_index + 1]
    vim.cmd("edit " .. vim.fn.fnameescape(next_file.full_path))
  elseif #file_list > 0 then
    -- If current file not in list or at end, go to first
    vim.cmd("edit " .. vim.fn.fnameescape(file_list[1].full_path))
  end
end

function M.jump_to_prev_file()
  local current_file = vim.fn.expand("%:p")
  local cwd = vim.fn.getcwd()
  local relative_path = current_file:gsub("^" .. cwd .. "/", "")
  
  -- Find current file in the list
  local current_index = nil
  local file_list = {}
  
  for line_num, data in pairs(line_data) do
    table.insert(file_list, {line_num = line_num, path = data.file, full_path = data.full_path})
    if data.file == relative_path then
      current_index = #file_list
    end
  end
  
  -- Sort by line number
  table.sort(file_list, function(a, b) return a.line_num < b.line_num end)
  
  if current_index and current_index > 1 then
    local prev_file = file_list[current_index - 1]
    vim.cmd("edit " .. vim.fn.fnameescape(prev_file.full_path))
  elseif #file_list > 0 then
    -- If current file not in list or at beginning, go to last
    vim.cmd("edit " .. vim.fn.fnameescape(file_list[#file_list].full_path))
  end
end

return M
