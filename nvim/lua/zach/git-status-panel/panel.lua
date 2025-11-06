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
  vim.api.nvim_buf_set_option(buf, "spell", false)

  -- Set up syntax highlighting
  M.setup_highlights()

  -- Set buffer in current window
  win = vim.api.nvim_get_current_win()
  vim.api.nvim_win_set_buf(win, buf)

  -- Resize split
  vim.cmd("vertical resize " .. config.window.width)

  -- Set window options
  vim.api.nvim_win_set_option(win, "wrap", false)
  vim.api.nvim_win_set_option(win, "cursorline", true)
  vim.api.nvim_win_set_option(win, "winfixwidth", true) -- Prevent resizing
  vim.api.nvim_win_set_option(win, "spell", false)
  vim.api.nvim_win_set_option(win, "number", false)
  vim.api.nvim_win_set_option(win, "relativenumber", false)

  -- Set up keymaps
  M.setup_keymaps()

  -- Set up autocmds for cursorline management
  vim.api.nvim_create_autocmd({"BufEnter", "WinEnter"}, {
    buffer = buf,
    callback = function()
      vim.api.nvim_win_set_option(0, "cursorline", true)
    end
  })

  vim.api.nvim_create_autocmd({"BufLeave", "WinLeave"}, {
    buffer = buf,
    callback = function()
      vim.api.nvim_win_set_option(0, "cursorline", false)
    end
  })

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

function M.setup_highlights()
  -- Define simple highlight groups with direct colors
  vim.api.nvim_set_hl(0, "GitStatusModified", { fg = "#f9e2af" }) -- Catppuccin yellow
  vim.api.nvim_set_hl(0, "GitStatusAdded", { fg = "#a6e3a1" }) -- Catppuccin green
  vim.api.nvim_set_hl(0, "GitStatusDeleted", { fg = "#f38ba8" }) -- Catppuccin red
  vim.api.nvim_set_hl(0, "GitStatusRenamed", { fg = "#fab387" }) -- Catppuccin peach/orange
  vim.api.nvim_set_hl(0, "GitStatusUntracked", { fg = "#89b4fa" }) -- Catppuccin blue
  vim.api.nvim_set_hl(0, "GitStatusCurrent", { bg = "#313244" }) -- Catppuccin surface0 background
  vim.api.nvim_set_hl(0, "GitStatusProject", { fg = "#cba6f7", bold = true }) -- Catppuccin mauve, bold
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

  -- Revert unstaged changes only
  vim.keymap.set("n", "u", M.revert_unstaged, opts)

  -- Delete file
  vim.keymap.set("n", "d", M.delete_file, opts)

  -- Show diff
  vim.keymap.set("n", "p", M.show_diff, opts)

  -- Commit staged changes
  vim.keymap.set("n", "c", M.commit_staged, opts)

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

  if vim.tbl_isempty(status_data) then
    table.insert(lines, "No repositories found")
  else
    -- Sort repo names for stable order
    local sorted_repos = {}
    for repo_name, _ in pairs(status_data) do
      table.insert(sorted_repos, repo_name)
    end
    table.sort(sorted_repos)

    for _, repo_name in ipairs(sorted_repos) do
      local repo_data = status_data[repo_name]

      -- Always show repo/package name with branch (for both single and multiple repos)
      local header = repo_name
      if repo_data.branch then
        header = header .. " (" .. repo_data.branch .. ")"
      end
      table.insert(lines, header)
      -- Store project data for this line
      line_data[line_num] = {
        is_project = true,
        repo_path = repo_data.path,
        repo_name = repo_name
      }
      line_num = line_num + 1

      -- Show files if any exist
      if #repo_data.files > 0 then
        for _, file_data in ipairs(repo_data.files) do
          -- Filter for unstaged changes if requested
          if not unstaged_only or file_data.status:sub(2, 2) ~= " " then
            local filename = vim.fn.fnamemodify(file_data.file, ":t")
            local line_text = file_data.status .. " " .. filename
            table.insert(lines, line_text)

            -- Store complete file data for this line
            line_data[line_num] = {
              file = file_data.file,
              full_path = file_data.full_path,
              status = file_data.status,
              repo_path = repo_data.path,
              is_current = file_data.file == current_relative
            }
            line_num = line_num + 1
          end
        end
      else
        -- Show "No changes" under the project header
        table.insert(lines, "  No changes")
        line_num = line_num + 1
      end

      -- Add spacing between repos if multiple
      if vim.tbl_count(status_data) > 1 then
        table.insert(lines, "")
        line_num = line_num + 1
      end
    end
  end

  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)

  -- Apply highlighting with extmarks after setting lines
  local ns = vim.api.nvim_create_namespace("git-status-panel")
  vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)

  for i, line in ipairs(lines) do
    local line_idx = i - 1 -- 0-based indexing

    -- Highlight project headers (lines that contain branch info in parentheses but don't contain equals)
    if line:match("%(.*%)$") and not line:match(" = ") then
      vim.api.nvim_buf_set_extmark(buf, ns, line_idx, 0, {
        end_col = #line,
        hl_group = "GitStatusProject"
      })
    end

    -- Highlight git status codes
    if line:match("^[ MADR?]") then
      local status = line:sub(1, 2)
      local hl_group = nil

      -- Highlight first character
      local first_char = status:sub(1, 1)
      local second_char = status:sub(2, 2)

      if first_char == "A" then
        vim.api.nvim_buf_set_extmark(buf, ns, line_idx, 0, {
          end_col = 1,
          hl_group = "GitStatusAdded"
        })
      elseif first_char == "M" then
        vim.api.nvim_buf_set_extmark(buf, ns, line_idx, 0, {
          end_col = 1,
          hl_group = "GitStatusModified"
        })
      elseif first_char == "D" then
        vim.api.nvim_buf_set_extmark(buf, ns, line_idx, 0, {
          end_col = 1,
          hl_group = "GitStatusDeleted"
        })
      elseif first_char == "R" then
        vim.api.nvim_buf_set_extmark(buf, ns, line_idx, 0, {
          end_col = 1,
          hl_group = "GitStatusRenamed"
        })
      elseif first_char == "?" then
        vim.api.nvim_buf_set_extmark(buf, ns, line_idx, 0, {
          end_col = 2,
          hl_group = "GitStatusUntracked"
        })
      end

      -- Highlight second character if it's not space and not part of ??
      if second_char ~= " " and status ~= "??" then
        if second_char == "M" then
          vim.api.nvim_buf_set_extmark(buf, ns, line_idx, 1, {
            end_col = 2,
            hl_group = "GitStatusModified"
          })
        elseif second_char == "D" then
          vim.api.nvim_buf_set_extmark(buf, ns, line_idx, 1, {
            end_col = 2,
            hl_group = "GitStatusDeleted"
          })
        end
      end

      -- Highlight current file line (check line_data for current file)
      for line_num, data in pairs(line_data) do
        if data.is_current and line_num == line_idx + 1 then
          vim.api.nvim_buf_set_extmark(buf, ns, line_idx, 0, {
            end_col = #line,
            hl_group = "GitStatusCurrent"
          })
          break
        end
      end
    end
  end

  vim.api.nvim_buf_set_option(buf, "modifiable", false)
end

function M.open_file()
  local line_num = vim.api.nvim_win_get_cursor(0)[1]
  local data = line_data[line_num]

  if data then
    if data.is_project then
      -- Open project directory in Oil in the previous window
      vim.cmd("wincmd p") -- Go to previous window
      require("oil").open(data.repo_path)
    else
      -- Open file normally
      vim.cmd("wincmd p") -- Go to previous window
      vim.cmd("edit " .. vim.fn.fnameescape(data.full_path))
      -- Refresh the git status panel to update current file highlighting
      vim.defer_fn(function()
        require("zach.git-status-panel").refresh()
      end, 100)
    end
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

function M.revert_unstaged()
  local line_num = vim.api.nvim_win_get_cursor(0)[1]
  local data = line_data[line_num]
  
  if not data or not data.repo_path then
    return
  end
  
  -- Check if file has unstaged changes
  if data.status:sub(2, 2) == " " then
    vim.notify("No unstaged changes to revert for " .. data.file, vim.log.levels.WARN)
    return
  end
  
  -- Confirmation prompt
  local choice = vim.fn.confirm("Revert unstaged changes to " .. data.file .. "?", "&Yes\n&No", 2)
  if choice ~= 1 then
    return
  end
  
  local cmd = { "git", "checkout", "--", data.file }
  
  vim.system(cmd, { cwd = data.repo_path }, function(result)
    vim.schedule(function()
      if result.code == 0 then
        require("zach.git-status-panel").refresh()
      else
        vim.notify("Failed to revert unstaged changes for " .. data.file, vim.log.levels.ERROR)
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

function M.commit_staged()
  -- Get all repositories with staged changes
  local git_module = require("zach.git-status-panel.git")
  local repos = git_module.find_repos()

  if #repos == 0 then
    vim.notify("No repositories found", vim.log.levels.WARN)
    return
  end

  -- First, check which repos have staged changes
  local repos_with_staged = {}
  local pending_checks = #repos

  for _, repo in ipairs(repos) do
    local cmd = { "git", "diff", "--cached", "--name-only" }
    vim.system(cmd, { cwd = repo }, function(result)
      vim.schedule(function()
        if result.code == 0 and result.stdout and result.stdout:match("%S") then
          table.insert(repos_with_staged, repo)
        end

        pending_checks = pending_checks - 1
        if pending_checks == 0 then
          -- All checks completed
          if #repos_with_staged == 0 then
            vim.notify("No staged changes to commit", vim.log.levels.WARN)
            return
          end

          -- Prompt for commit message
          Snacks.input({
            prompt = "Commit message: ",
            title = "Git Commit (" .. #repos_with_staged .. " repos)",
          }, function(commit_msg)
            if not commit_msg or commit_msg == "" then
              return
            end

            local pending = #repos_with_staged
            local success_count = 0
            local error_repos = {}

            for _, repo in ipairs(repos_with_staged) do
              local repo_name = vim.fn.fnamemodify(repo, ":t")
              local cmd = { "git", "commit", "-m", commit_msg }

              vim.system(cmd, { cwd = repo }, function(result)
                vim.schedule(function()
                  if result.code == 0 then
                    success_count = success_count + 1
                  else
                    table.insert(error_repos, repo_name)
                  end

                  pending = pending - 1
                  if pending == 0 then
                    -- All commits completed
                    if success_count > 0 then
                      vim.notify(string.format("Committed %d repositories", success_count), vim.log.levels.INFO)
                    end
                    if #error_repos > 0 then
                      vim.notify("Failed to commit: " .. table.concat(error_repos, ", "), vim.log.levels.ERROR)
                    end
                    -- Refresh the panel
                    require("zach.git-status-panel").refresh()
                  end
                end)
              end)
            end
          end)
        end
      end)
    end)
  end
end

return M
