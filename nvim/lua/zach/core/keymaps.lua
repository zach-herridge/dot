vim.g.mapleader = " "

local keymap = vim.keymap

-- Disable command history and search history windows
keymap.set("n", "q:", "<nop>")
keymap.set("n", "q/", "<nop>")
keymap.set("n", "q?", "<nop>")

keymap.set({ "n", "i", "v" }, "<Left>", "")
keymap.set({ "n", "i", "v" }, "<Right>", "")
keymap.set({ "n", "i", "v" }, "<Up>", "")
keymap.set({ "n", "i", "v" }, "<Down>", "")

keymap.set({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })
keymap.set({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })

keymap.set({ "n" }, "<leader>rs", ":%s//X/gc<Left><Left><Left><Left><Left>")

keymap.set("n", "<leader>yP", function()
  local path = vim.fn.expand("%:p")
  vim.fn.setreg("+", path)
end, { desc = "Copy file path" })

keymap.set("n", "<leader>yp", function()
  local path = vim.fn.expand("%:p")
  local line = vim.fn.line(".")
  vim.fn.setreg("+", path .. ":" .. line)
end, { desc = "Copy file path with line number" })

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

keymap.set("n", "<leader>oL", function()
  local path = vim.fn.expand("%:p")
  local line = vim.fn.line(".")

  -- Get git root and current branch/commit
  local git_root = vim.fn.system("git rev-parse --show-toplevel"):gsub("\n", "")
  local commit = vim.fn.system("git rev-parse HEAD"):gsub("\n", "")

  -- Get relative path from git root
  local rel_path = path:gsub(git_root .. "/", "")

  -- Extract package name from git root
  local package_name = git_root:match("([^/]+)$")

  -- Build Amazon Git Farm URL
  local url = string.format("https://code.amazon.com/packages/%s/blobs/%s/--/%s#L%d",
    package_name, commit, rel_path, line)

  -- Open in browser
  vim.fn.system("open '" .. url .. "'")
  vim.notify("Opened: " .. url)
end, { desc = "Open in Amazon Git Farm" })

keymap.set("n", "<leader>oP", function()
  local git_root = vim.fn.system("git rev-parse --show-toplevel"):gsub("\n", "")
  local package_name = git_root:match("([^/]+)$")
  local url = "https://code.amazon.com/packages/" .. package_name

  vim.fn.system("open '" .. url .. "'")
  vim.notify("Opened: " .. url)
end, { desc = "Open package in Amazon Git Farm" })

keymap.set("n", "<leader>op", function()
  local package_name = vim.fn.expand("<cword>")
  local url = "https://code.amazon.com/packages/" .. package_name

  vim.fn.system("open '" .. url .. "'")
  vim.notify("Opened: " .. url)
end, { desc = "Open package under cursor" })

keymap.set("n", "<leader>oe", function()
  local dir
  if vim.bo.filetype == "oil" then
    dir = require("oil").get_current_dir()
  else
    dir = vim.fn.expand("%:p:h")
  end
  vim.fn.system("open '" .. dir .. "'")
end, { desc = "Open explorer" })
keymap.set("n", "<leader>om", "<cmd>Mason<cr>", { desc = "Open mason" })
keymap.set("n", "<leader>ol", "<cmd>Lazy<cr>", { desc = "Open lazy" })

keymap.set("n", "<leader>ou", function()
  local url = vim.fn.expand("<cWORD>")
  if url:match("^https?://") then
    vim.fn.system("open '" .. url .. "'")
    vim.notify("Opened: " .. url)
  else
    vim.notify("No URL under cursor")
  end
end, { desc = "Open URL under cursor" })

keymap.set("n", "<leader>c", "", { desc = "+code" })
keymap.set("n", "<leader>cf", "", { desc = "+format" })
keymap.set("n", "<leader>o", "", { desc = "+open" })

-- Formatting operations
keymap.set("n", "<leader>cft", ":%s/\\s\\+$//e<CR>", { desc = "Remove trailing spaces" })
keymap.set("n", "<leader>cff", function()
  vim.lsp.buf.format({ async = true })
end, { desc = "LSP format" })

keymap.set("n", "<leader>cq", function()
  require('zach.cloudwatch').execute_query()
end, { desc = "Execute CloudWatch query" })
