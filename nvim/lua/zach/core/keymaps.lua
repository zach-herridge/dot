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
