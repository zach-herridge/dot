vim.g.mapleader = " "

local keymap = vim.keymap

keymap.set({ "n", "i", "v" }, "<Left>", "")
keymap.set({ "n", "i", "v" }, "<Right>", "")
keymap.set({ "n", "i", "v" }, "<Up>", "")
keymap.set({ "n", "i", "v" }, "<Down>", "")

keymap.set({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })
keymap.set({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })

keymap.set({ "n" }, "<leader>rs", ":%s//X/gc<Left><Left><Left><Left><Left>")

keymap.set("n", "<leader>cP", function()
  local path = vim.fn.expand("%:p")
  vim.fn.setreg("+", path)
end, { desc = "Copy file path" })

keymap.set("n", "<leader>cR", function()
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

keymap.set("n", "<leader>c", "", { desc = "+code" })
