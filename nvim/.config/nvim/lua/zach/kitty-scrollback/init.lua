local M = {}

function M.setup()
  -- Catppuccin Mocha palette
  vim.api.nvim_set_hl(0, "KsbUserHeader", { fg = "#89b4fa", bold = true }) -- blue
  vim.api.nvim_set_hl(0, "KsbAssistantHeader", { fg = "#cba6f7", bold = true }) -- mauve
  vim.api.nvim_set_hl(0, "KsbSeparator", { fg = "#585b70" }) -- surface2
  vim.api.nvim_set_hl(0, "KsbToolCall", { fg = "#89dceb", bold = true }) -- teal
  vim.api.nvim_set_hl(0, "KsbToolDetail", { fg = "#6c7086", italic = true }) -- overlay0
  vim.api.nvim_set_hl(0, "KsbTimestamp", { fg = "#6c7086" }) -- overlay0
  vim.api.nvim_set_hl(0, "KsbOutput", { fg = "#a6adc8" }) -- subtext0
  vim.api.nvim_set_hl(0, "KsbOutputBorder", { fg = "#45475a" }) -- surface1
  vim.api.nvim_set_hl(0, "KsbCodeFence", { fg = "#45475a" }) -- surface1
  vim.api.nvim_set_hl(0, "KsbCodeLang", { fg = "#f9e2af" }) -- yellow
end

-- This viewer runs inside a `tmux popup`, which (unlike a normal pane) does NOT
-- relay a child program's OSC 52 out to the host terminal — tmux's set-clipboard
-- interception only applies to panes, and DCS passthrough from a popup is
-- silently dropped too. So the default OSC 52 provider yanks into the register
-- but the escape never reaches the Mac clipboard.
--
-- Fix: hand the data to the tmux SERVER via `tmux load-buffer -w -`. The `-w`
-- flag makes tmux itself emit the OSC 52 to its attached client (kitty) from
-- OUTSIDE the popup, so the popup boundary is irrelevant. (Requires
-- `set-clipboard on`, which tmux.conf sets.) `load-buffer` reads the data from
-- stdin (`-`), avoiding argv length/escaping limits on large yanks — note
-- `set-buffer` takes data as an argument instead, so it can't be used here.
local function install_tmux_loadbuffer_clipboard()
  local function copy(reg)
    return function(lines)
      local payload = table.concat(lines, "\n")
      -- Synchronous: an async jobstart can be torn down when the viewer quits
      -- right after the yank, before the data is flushed. system() with the
      -- payload on stdin both blocks until done and avoids shell quoting.
      vim.fn.system({ "tmux", "load-buffer", "-w", "-" }, payload)
    end
  end
  -- Paste just returns the register so `p` inside the read-only viewer works.
  local function paste(reg)
    return function()
      return vim.split(vim.fn.getreg(reg), "\n"), vim.fn.getregtype(reg)
    end
  end
  vim.g.clipboard = {
    name = "tmux-setbuffer-w",
    copy = { ["+"] = copy("+"), ["*"] = copy("*") },
    paste = { ["+"] = paste("+"), ["*"] = paste("*") },
  }
end

function M.launch(data_str)
  local ok, data = pcall(vim.fn.json_decode, data_str)
  if not ok then
    vim.notify("kitty-scrollback: failed to parse data", vim.log.levels.ERROR)
    return
  end

  -- Detect source environment (kitty or tmux)
  data.source = data.source or "kitty"

  -- In the tmux popup, route clipboard through `tmux load-buffer -w` so the tmux
  -- server (not the popup child) emits OSC 52 to the host terminal.
  if data.source == "tmux" and vim.env.TMUX and vim.env.TMUX ~= "" then
    install_tmux_loadbuffer_clipboard()
  end

  if data.mode == "claude" and data.conversation_file then
    require("zach.kitty-scrollback.claude").open(data)
  else
    require("zach.kitty-scrollback.scrollback").open(data)
  end
end

return M
