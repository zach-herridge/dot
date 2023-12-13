vim.g.mapleader = " "

local keymap = vim.keymap

-- disable arrow keys
keymap.set({ "n", "i", "v" }, "<Left>", "")
keymap.set({ "n", "i", "v" }, "<Right>", "")
keymap.set({ "n", "i", "v" }, "<Up>", "")
keymap.set({ "n", "i", "v" }, "<Down>", "")

-- better up/down
keymap.set({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })
keymap.set({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })

-- find/replace shortcut
keymap.set({ "n" }, "<leader>rs", ":%s///gc<Left><Left><Left><Left>")
