vim.g.mapleader = " "

local keymap = vim.keymap -- for conciseness

-- disable arrow keys
keymap.set("i", "<Left>", "")
keymap.set("i", "<Right>", "")
keymap.set("i", "<Up>", "")
keymap.set("i", "<Down>", "")
keymap.set("n", "<Left>", "")
keymap.set("n", "<Right>", "")
keymap.set("n", "<Up>", "")
keymap.set("n", "<Down>", "")

-- better up/down
keymap.set({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })
keymap.set({ "n", "x" }, "<Down>", "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })
keymap.set({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })
keymap.set({ "n", "x" }, "<Up>", "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })

