local M = {}

-- Shared ripgrep ignore patterns
M.ignores = {
  "--glob=!.git/",
  "--glob=!**/node_modules/**",
  "--glob=!**/build/**",
  "--glob=!build/**",
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
  "--glob=!package-lock.json",
  "--glob=!yarn.lock",
  "--glob=!*.min.js",
  "--glob=!*.min.css",
}

-- Base ripgrep args
M.base_args = {
  "--column",
  "--line-number",
  "--no-heading",
  "--color=never",
  "--smart-case",
  "--hidden",
}

-- Merge base args with ignores
function M.make_args(extra_args)
  local args = vim.tbl_extend("force", {}, M.base_args)
  if extra_args then
    vim.list_extend(args, extra_args)
  end
  vim.list_extend(args, M.ignores)
  return args
end

return M
