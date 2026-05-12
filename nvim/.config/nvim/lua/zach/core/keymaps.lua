vim.g.mapleader = " "

local keymap = vim.keymap

-- Disable command history and search history windows
keymap.set("n", "q:", "<nop>")
keymap.set("n", "q/", "<nop>")
keymap.set("n", "q?", "<nop>")

keymap.set({ "n", "i", "v" }, "<Left>", "<nop>")
keymap.set({ "n", "i", "v" }, "<Right>", "<nop>")
keymap.set({ "n", "i", "v" }, "<Up>", "<nop>")
keymap.set({ "n", "i", "v" }, "<Down>", "<nop>")

keymap.set({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })
keymap.set({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })

keymap.set({ "n" }, "<leader>rs", ":%s//X/gc<Left><Left><Left><Left><Left>")

keymap.set("n", "<leader>yp", function()
  local path = vim.fn.expand("%:p")
  vim.fn.setreg("+", path)
end, { desc = "Copy file path" })

keymap.set("n", "<leader>yR", function()
  local path = vim.fn.expand("%:p")
  local ft = vim.bo.filetype

  if ft == "java" or ft == "kotlin" then
    -- Find src/main/java or src/main/kotlin in path
    local src_pattern = ".*[/\\]src[/\\]main[/\\]" .. (ft == "java" and "java" or "kotlin") .. "[/\\]"
    local package_path = path:gsub(src_pattern, "")

    -- Remove file extension and convert path separators to dots
    package_path = package_path:gsub("%.[^.]*$", "")
    package_path = package_path:gsub("[/\\]", ".")

    vim.fn.setreg("+", package_path)
    vim.notify("Copied: " .. package_path)
  elseif ft == "typescript" or ft == "typescriptreact" then
    -- Find src/ in path or use relative from project root
    local src_pattern = ".*[/\\]src[/\\]"
    local import_path = path:gsub(src_pattern, "")

    -- Remove file extension and convert to import path
    import_path = import_path:gsub("%.tsx?$", "")
    import_path = import_path:gsub("[/\\]", "/")
    import_path = "./" .. import_path

    vim.fn.setreg("+", import_path)
    vim.notify("Copied: " .. import_path)
  else
    vim.notify("Copy reference works for Java/Kotlin/TypeScript files")
  end
end, { desc = "Copy package reference" })

-- Helper: guard git commands and return nil on failure
local function git_cmd(args)
  local result = vim.fn.system(args)
  if vim.v.shell_error ~= 0 then return nil end
  return result:gsub("\n", "")
end

keymap.set("n", "<leader>oL", function()
  local git_root = git_cmd({ "git", "rev-parse", "--show-toplevel" })
  if not git_root then return vim.notify("Not in a git repo", vim.log.levels.WARN) end
  local commit = git_cmd({ "git", "rev-parse", "HEAD" })
  if not commit then return end

  local path = vim.fn.expand("%:p")
  local line = vim.fn.line(".")
  local rel_path = path:gsub(git_root .. "/", "")
  local package_name = git_root:match("([^/]+)$")

  local url = string.format("https://code.amazon.com/packages/%s/blobs/%s/--/%s#L%d",
    package_name, commit, rel_path, line)

  vim.fn.system({ "open", url })
  vim.notify("Opened: " .. url)
end, { desc = "Open in Amazon Git Farm" })

keymap.set("n", "<leader>oP", function()
  local git_root = git_cmd({ "git", "rev-parse", "--show-toplevel" })
  if not git_root then return vim.notify("Not in a git repo", vim.log.levels.WARN) end
  local package_name = git_root:match("([^/]+)$")
  local url = "https://code.amazon.com/packages/" .. package_name

  vim.fn.system({ "open", url })
  vim.notify("Opened: " .. url)
end, { desc = "Open package in Amazon Git Farm" })

keymap.set("n", "<leader>op", function()
  local package_name = vim.fn.expand("<cword>")
  local url = "https://code.amazon.com/packages/" .. package_name

  vim.fn.system({ "open", url })
  vim.notify("Opened: " .. url)
end, { desc = "Open package under cursor" })

keymap.set("n", "<leader>oe", function()
  local dir
  if vim.bo.filetype == "oil" then
    dir = require("oil").get_current_dir()
  else
    dir = vim.fn.expand("%:p:h")
  end
  vim.fn.system({ "open", dir })
end, { desc = "Open explorer" })
keymap.set("n", "<leader>om", "<cmd>Mason<cr>", { desc = "Open mason" })
keymap.set("n", "<leader>ol", "<cmd>Lazy<cr>", { desc = "Open lazy" })

keymap.set("n", "<leader>ou", function()
  local url = vim.fn.expand("<cWORD>")
  if url:match("^https?://") then
    vim.fn.system({ "open", url })
    vim.notify("Opened: " .. url)
  else
    vim.notify("No URL under cursor")
  end
end, { desc = "Open URL under cursor" })

-- Formatting operations
keymap.set("n", "<leader>cf", "", { desc = "+format" })
keymap.set("n", "<leader>cft", ":%s/\\s\\+$//e<CR>", { desc = "Remove trailing spaces" })
keymap.set("n", "<leader>cff", function()
  vim.lsp.buf.format({ async = true })
end, { desc = "LSP format" })

-- Diagnostic navigation
keymap.set("n", "]d", function() vim.diagnostic.jump({ count = 1 }) end, { desc = "Next diagnostic" })
keymap.set("n", "[d", function() vim.diagnostic.jump({ count = -1 }) end, { desc = "Previous diagnostic" })

local function set_cd_target()
  local dir = vim.bo.filetype == "oil" and require("oil").get_current_dir() or vim.fn.expand("%:p:h")
  vim.fn.writefile({dir}, "/tmp/nvim_cd_target")
end

keymap.set("n", "<leader>kd", set_cd_target, { desc = "Set shell cd target" })
keymap.set("n", "<leader>kD", function() set_cd_target() vim.cmd("qa") end, { desc = "Set shell cd target and exit" })
