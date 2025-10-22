vim.g.mapleader = " "

local keymap = vim.keymap

keymap.set({ "n", "i", "v" }, "<Left>", "")
keymap.set({ "n", "i", "v" }, "<Right>", "")
keymap.set({ "n", "i", "v" }, "<Up>", "")
keymap.set({ "n", "i", "v" }, "<Down>", "")

keymap.set({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })
keymap.set({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })

keymap.set({ "n" }, "<leader>rs", ":%s//X/gc<Left><Left><Left><Left><Left>")

keymap.set("n", "<leader>cp", function()
  local path = vim.fn.expand("%:p")
  vim.fn.setreg("+", path)
  print("Copied: " .. path)
end, { desc = "Copy file path" })

keymap.set("n", "<leader>c", "", { desc = "+code" })
