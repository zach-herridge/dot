local opt = vim.opt

-- disable cmd line to make room for lualine
vim.o.cmdheight = 0

-- line numbers
opt.relativenumber = true
opt.number = true

-- pad cursor
opt.scrolloff = 9
opt.sidescrolloff = 9

opt.smoothscroll = true

-- undo
opt.undofile = true
opt.undolevels = 10000

-- tabs & indentation
opt.tabstop = 2
opt.shiftwidth = 2
opt.expandtab = true
opt.autoindent = true

-- line wrapping
opt.wrap = false

-- search settings
opt.ignorecase = true
opt.smartcase = true

-- cursor line
opt.cursorline = true

-- appearance
opt.termguicolors = true
opt.background = "dark"
opt.signcolumn = "yes"

-- backspace
opt.backspace = "indent,eol,start"

-- clipboard
opt.clipboard:append("unnamedplus")

-- split windows
opt.splitright = true
opt.splitbelow = true

-- include in word
opt.iskeyword:append("_")
opt.iskeyword:append("-")
