-- ui.lua — Shared buffer/window setup and keymaps for the viewer.
-- Both the scrollback and Claude renderers share the same "read-only scratch
-- buffer in a full-screen popup" presentation, so that lives here.

local M = {}

--- Configure the current window for a clean, chrome-free reading view.
---@param opts? { wrap?: boolean }
function M.style_window(opts)
  opts = opts or {}
  local win = vim.api.nvim_get_current_win()
  vim.wo[win].wrap = opts.wrap or false
  vim.wo[win].linebreak = opts.wrap or false
  vim.wo[win].number = false
  vim.wo[win].relativenumber = false
  vim.wo[win].signcolumn = "no"
  vim.wo[win].list = false
  vim.wo[win].cursorline = true
end

--- Turn the current buffer into a locked-down read-only scratch buffer.
---@return integer buf
function M.scratch_buffer()
  local buf = vim.api.nvim_get_current_buf()
  vim.bo[buf].buftype = "nofile"
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].swapfile = false
  vim.bo[buf].modifiable = true -- caller fills it, then calls lock()
  return buf
end

--- Mark the buffer read-only once content is in place.
---@param buf integer
function M.lock(buf)
  vim.bo[buf].modifiable = false
  vim.bo[buf].modified = false
end

--- Install the universal quit keys (q / Esc close the whole popup).
---@param buf integer
function M.setup_quit_keys(buf)
  local opts = { buffer = buf, silent = true, nowait = true }
  local function quit()
    vim.cmd("qa!")
  end
  vim.keymap.set("n", "q", quit, opts)
  vim.keymap.set("n", "<Esc>", quit, opts)
end

--- Pin a context line at the top of the window (stays visible while scrolling).
--- Segments are { text = "...", group = "HighlightGroup" }.
---@param segments { text: string, group?: string }[]
function M.set_winbar(segments)
  local parts = {}
  for _, seg in ipairs(segments) do
    if seg.group then
      table.insert(parts, ("%%#%s#%s%%*"):format(seg.group, seg.text))
    else
      table.insert(parts, seg.text)
    end
  end
  vim.wo[vim.api.nvim_get_current_win()].winbar = table.concat(parts)
end

--- Show a centered message in a dismissable buffer. Used for empty/error
--- states so the user is never stuck in a blank full-screen popup with no
--- obvious way out (q / Esc always close it).
---@param message string
function M.show_message(message)
  M.style_window({ wrap = true })
  local buf = M.scratch_buffer()
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, {
    "",
    "  " .. message,
    "",
    "  (press q or Esc to close)",
  })
  M.lock(buf)
  M.setup_quit_keys(buf)
end

return M
