local opt = vim.opt

vim.opt.spelllang = 'en_us'
vim.opt.spell = true

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
opt.clipboard = "unnamedplus"

-- live preview of :s substitutions
opt.inccommand = "split"

-- wrapped lines keep indentation
opt.breakindent = true

-- cap completion menu height
opt.pumheight = 10

-- free cursor in visual block mode
opt.virtualedit = "block"

-- split windows
opt.splitright = true
opt.splitbelow = true

-- include in word
opt.iskeyword:append("_")
opt.iskeyword:append("-")
