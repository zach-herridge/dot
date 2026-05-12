-- Kitten transfer integration for neovim
-- Works when connected via `kitten ssh` (alias `s`)
--
-- Keymaps:
--   <leader>ts  Send current file to ~/Downloads
--   <leader>tS  Send current file to custom local path
--   <leader>tr  Receive a file from local Mac
--   <leader>ty  Send visual selection as a snippet file

local M = {}

local default_dest = "~/Downloads/"

--- Check if kitten transfer is available (i.e. we're in a kitten ssh session)
---@return boolean
local function has_kitten()
  return vim.fn.executable("kitten") == 1
end

--- Notify with transfer-specific prefix
---@param msg string
---@param level? integer
local function notify(msg, level)
  vim.notify(msg, level or vim.log.levels.INFO)
end

--- Send file(s) to local machine
---@param paths string[] remote file paths
---@param dest string local destination
function M.send(paths, dest)
  if not has_kitten() then
    notify("Not in a kitten ssh session", vim.log.levels.ERROR)
    return
  end

  local cmd = { "kitten", "transfer" }
  for _, p in ipairs(paths) do
    table.insert(cmd, p)
  end
  table.insert(cmd, dest)

  notify("Sending " .. #paths .. " file(s)...")

  vim.system(cmd, { text = true }, function(result)
    vim.schedule(function()
      if result.code == 0 then
        local names = {}
        for _, p in ipairs(paths) do
          table.insert(names, vim.fn.fnamemodify(p, ":t"))
        end
        notify("Sent → " .. dest .. " (" .. table.concat(names, ", ") .. ")")
      else
        notify("Transfer failed: " .. (result.stderr or "unknown error"), vim.log.levels.ERROR)
      end
    end)
  end)
end

--- Receive file from local machine into remote directory
---@param local_path string path on local Mac
---@param remote_dest? string remote destination (defaults to cwd)
function M.receive(local_path, remote_dest)
  if not has_kitten() then
    notify("Not in a kitten ssh session", vim.log.levels.ERROR)
    return
  end

  remote_dest = remote_dest or vim.fn.getcwd()
  local cmd = { "kitten", "transfer", "--direction=receive", local_path, remote_dest }

  notify("Receiving " .. local_path .. "...")

  vim.system(cmd, { text = true }, function(result)
    vim.schedule(function()
      if result.code == 0 then
        local filename = vim.fn.fnamemodify(local_path, ":t")
        local received_path = remote_dest .. "/" .. filename
        notify("Received → " .. received_path)

        -- Offer to open
        vim.ui.select({ "Open", "Open in split", "Dismiss" }, {
          prompt = "Open " .. filename .. "?",
        }, function(choice)
          if choice == "Open" then
            vim.cmd("edit " .. vim.fn.fnameescape(received_path))
          elseif choice == "Open in split" then
            vim.cmd("vsplit " .. vim.fn.fnameescape(received_path))
          end
        end)
      else
        notify("Transfer failed: " .. (result.stderr or "unknown error"), vim.log.levels.ERROR)
      end
    end)
  end)
end

--- Send visual selection as a snippet file
---@param lines string[]
---@param dest string
function M.send_snippet(lines, dest)
  if not has_kitten() then
    notify("Not in a kitten ssh session", vim.log.levels.ERROR)
    return
  end

  -- Determine a filename from buffer + line range
  local bufname = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(0), ":t")
  if bufname == "" then
    bufname = "snippet"
  end
  local ext = vim.fn.fnamemodify(bufname, ":e")
  local base = vim.fn.fnamemodify(bufname, ":r")
  local timestamp = os.date("%H%M%S")
  local snippet_name = base .. "-" .. timestamp .. (ext ~= "" and ("." .. ext) or ".txt")

  -- Write to a temp file, transfer, then clean up
  local tmp = vim.fn.tempname() .. "-" .. snippet_name
  vim.fn.writefile(lines, tmp)

  local final_dest = dest .. snippet_name

  vim.system({ "kitten", "transfer", tmp, final_dest }, { text = true }, function(result)
    vim.schedule(function()
      vim.fn.delete(tmp)
      if result.code == 0 then
        notify("Snippet → " .. final_dest)
      else
        notify("Transfer failed: " .. (result.stderr or ""), vim.log.levels.ERROR)
      end
    end)
  end)
end

function M.setup()
  -- Send current file to ~/Downloads
  vim.keymap.set("n", "<leader>ts", function()
    local file = vim.api.nvim_buf_get_name(0)
    if file == "" then
      notify("Buffer has no file on disk", vim.log.levels.WARN)
      return
    end
    M.send({ file }, default_dest)
  end, { desc = "Send file to local" })

  -- Send current file to custom destination
  vim.keymap.set("n", "<leader>tS", function()
    local file = vim.api.nvim_buf_get_name(0)
    if file == "" then
      notify("Buffer has no file on disk", vim.log.levels.WARN)
      return
    end
    vim.ui.input({ prompt = "Local destination: ", default = default_dest }, function(dest)
      if dest and dest ~= "" then
        M.send({ file }, dest)
      end
    end)
  end, { desc = "Send file to local (custom path)" })

  -- Receive file from local
  vim.keymap.set("n", "<leader>tr", function()
    vim.ui.input({ prompt = "Local file path: ", default = "~/" }, function(path)
      if path and path ~= "" then
        M.receive(path)
      end
    end)
  end, { desc = "Receive file from local" })

  -- Send visual selection as snippet
  vim.keymap.set("v", "<leader>ts", function()
    local start_line = vim.fn.line("'<")
    local end_line = vim.fn.line("'>")
    local lines = vim.api.nvim_buf_get_lines(0, start_line - 1, end_line, false)
    M.send_snippet(lines, default_dest)
  end, { desc = "Send selection to local" })
end

return M
