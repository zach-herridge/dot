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

-- Maps a navigator key to the tmux select-pane direction flag + the format
-- field that reports whether the pane is already at that edge (for no-wrap).
local NAV_DIRECTIONS = {
  ["<C-h>"] = { flag = "L", edge = "pane_at_left" },
  ["<C-j>"] = { flag = "D", edge = "pane_at_bottom" },
  ["<C-k>"] = { flag = "U", edge = "pane_at_top" },
  ["<C-l>"] = { flag = "R", edge = "pane_at_right" },
}

--- Close the viewer and move tmux focus one pane in `dir` from the pane the
--- viewer was opened over. A `tmux popup` is a modal overlay that grabs the
--- keyboard, so we can't keep it floating AND work in the neighbour — the
--- natural motion is "dismiss the overlay and land on the adjacent pane" in a
--- single keypress. The select-pane is guarded by the pane_at_<edge> flag so a
--- press at the layout edge is a no-op instead of wrapping around.
---@param pane_id string  The originating pane the popup overlays.
---@param dir { flag: string, edge: string }
local function navigate_and_close(pane_id, dir)
  -- if-shell: only select-pane when NOT already at that edge (#{edge} == 0).
  vim.fn.system({
    "tmux",
    "if-shell",
    "-F",
    "-t",
    pane_id,
    "#{" .. dir.edge .. "}",
    "", -- at edge: do nothing
    ("select-pane -t %s -%s"):format(pane_id, dir.flag),
  })
  vim.cmd("qa!")
end

--- Install the universal keys for a viewer buffer:
---   q / <Esc>      close the popup
---   <C-h/j/k/l>    close the popup AND move to the adjacent tmux pane
---
--- The viewer is a single read-only window inside a modal `tmux popup`, so
--- vim-tmux-navigator's global maps are useless here (one window, no
--- $TMUX_PANE → they'd run a broken `select-pane -t '' -<dir>`). We override
--- them buffer-locally with a "dismiss-and-navigate" action: e.g. with a
--- `1 | 2` split and the viewer open over pane 2, <C-h> closes it and focuses
--- pane 1 — matching the seamless navigation muscle memory.
---@param buf integer
---@param pane_id string|nil  Originating pane id; falls back to $ZACH_PV_PANE.
function M.setup_quit_keys(buf, pane_id)
  local opts = { buffer = buf, silent = true, nowait = true }
  local function quit()
    vim.cmd("qa!")
  end
  vim.keymap.set("n", "q", quit, opts)
  vim.keymap.set("n", "<Esc>", quit, opts)

  pane_id = pane_id or vim.env.ZACH_PV_PANE
  for key, dir in pairs(NAV_DIRECTIONS) do
    if pane_id and pane_id ~= "" then
      vim.keymap.set("n", key, function()
        navigate_and_close(pane_id, dir)
      end, opts)
    else
      -- No known origin pane: make the key inert rather than let the global
      -- navigator misfire against the underlying session.
      vim.keymap.set("n", key, "<Nop>", opts)
    end
  end
  -- <C-\> (navigator's "last pane") has no meaningful target here; keep inert.
  vim.keymap.set("n", "<C-\\>", "<Nop>", opts)
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
