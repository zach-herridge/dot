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
-- interception only applies to panes. So the default OSC 52 provider yanks into
-- the register but the escape dies at the popup boundary and never reaches the
-- Mac clipboard. Fix: emit OSC 52 wrapped in a tmux DCS passthrough
-- (\ePtmux;...\e\\), which tmux forwards verbatim to the outer terminal even
-- from a popup (requires `allow-passthrough on`, which our tmux.conf sets).
local function install_tmux_passthrough_clipboard()
  local function copy(reg)
    return function(lines)
      local payload = table.concat(lines, "\n")
      local b64 = vim.base64.encode(payload)
      local osc52 = "\027]52;c;" .. b64 .. "\007"
      -- Wrap for tmux passthrough: ESC P tmux; <payload with ESC doubled> ESC \
      local wrapped = "\027Ptmux;" .. osc52:gsub("\027", "\027\027") .. "\027\\"
      -- Write straight to the controlling terminal so it isn't buffered/lost.
      local f = io.open("/dev/tty", "w")
      if f then
        f:write(wrapped)
        f:close()
      else
        io.stdout:write(wrapped)
      end
    end
  end
  -- Paste from the viewer is not needed (read-only buffer); return the yanked
  -- register contents so `p` inside the popup still works.
  local function paste(reg)
    return function()
      return vim.split(vim.fn.getreg(reg), "\n"), vim.fn.getregtype(reg)
    end
  end
  vim.g.clipboard = {
    name = "tmux-passthrough-osc52",
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

  -- In the tmux popup, OSC 52 must be DCS-wrapped to escape to the host terminal.
  if data.source == "tmux" and vim.env.TMUX and vim.env.TMUX ~= "" then
    install_tmux_passthrough_clipboard()
  end

  if data.mode == "claude" and data.conversation_file then
    require("zach.kitty-scrollback.claude").open(data)
  else
    require("zach.kitty-scrollback.scrollback").open(data)
  end
end

return M
