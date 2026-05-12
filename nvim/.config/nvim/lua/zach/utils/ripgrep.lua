local M = {}

-- Shared ripgrep ignore patterns (junk directories/files to always skip)
M.ignores = {
  "--glob=!.git/",
  "--glob=!**/node_modules/**",
  "--glob=!**/build/**",
  "--glob=!**/dist/**",
  "--glob=!**/target/**",
  "--glob=!**/.next/**",
  "--glob=!**/.nuxt/**",
  "--glob=!**/vendor/**",
  "--glob=!**/__pycache__/**",
  "--glob=!**/env/**",
  "--glob=!**/tempindex/**",
  "--glob=!**/indexed/**",
  "--glob=!**/public/assets/**",
  "--glob=!**/release-info/**",
  "--glob=!**/logs/**",
  "--glob=!**/.cache/**",
  "--glob=!**/coverage/**",
  "--glob=!package-lock.json",
  "--glob=!yarn.lock",
  "--glob=!*.min.js",
  "--glob=!*.min.css",
  "--glob=!*.map",
}

-- Base ripgrep args
M.base_args = {
  "--column",
  "--line-number",
  "--no-heading",
  "--color=never",
  "--smart-case",
  "--hidden",
  "--no-require-git",
}

-- Build args list: base + extra + ignores
-- Uses vim.list_extend (not vim.tbl_extend which is for dicts)
function M.make_args(extra_args)
  local args = vim.list_extend({}, M.base_args)
  if extra_args then
    vim.list_extend(args, extra_args)
  end
  vim.list_extend(args, M.ignores)
  return args
end

return M
