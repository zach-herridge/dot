local M = {}

local config = {
  refresh_interval = 5000,
  window = {
    position = "right",
    width = 40,
    height = 0.8,
  },
}

local panel = require("zach.git-status-panel.panel")
local git = require("zach.git-status-panel.git")

local show_unstaged_only = false
local current_mode = nil -- Track current mode: "all" or "unstaged"

function M.setup(opts)
  config = vim.tbl_deep_extend("force", config, opts or {})
  
  -- Create user commands
  vim.api.nvim_create_user_command("GitStatusPanel", function()
    M.toggle()
  end, {})
  
  vim.api.nvim_create_user_command("GitStatusPanelUnstaged", function()
    M.toggle_unstaged()
  end, {})
  
  -- Auto-refresh timer
  if config.refresh_interval > 0 then
    local timer = vim.loop.new_timer()
    timer:start(0, config.refresh_interval, vim.schedule_wrap(function()
      if panel.is_open() then
        M.refresh()
      end
    end))
  end
end

function M.toggle()
  if panel.is_open() and current_mode == "all" then
    -- Same mode pressed again, close panel
    panel.close()
    current_mode = nil
  else
    -- Switch to all mode or open in all mode
    show_unstaged_only = false
    current_mode = "all"
    if panel.is_open() then
      M.refresh()
    else
      panel.toggle(config)
    end
  end
end

function M.toggle_unstaged()
  if panel.is_open() and current_mode == "unstaged" then
    -- Same mode pressed again, close panel
    panel.close()
    current_mode = nil
  else
    -- Switch to unstaged mode or open in unstaged mode
    show_unstaged_only = true
    current_mode = "unstaged"
    if panel.is_open() then
      M.refresh()
    else
      panel.toggle(config)
    end
  end
end

function M.refresh()
  local repos = git.find_repos()
  git.get_status_for_repos(repos, function(status_data)
    panel.update(status_data, show_unstaged_only)
  end)
end

function M.jump_to_next_file()
  panel.jump_to_next_file()
end

function M.jump_to_prev_file()
  panel.jump_to_prev_file()
end

return M
