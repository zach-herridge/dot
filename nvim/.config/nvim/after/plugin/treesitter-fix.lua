-- Workaround for Neovim 0.12 treesitter highlighter crash:
-- "attempt to call method 'range' (a nil value)"
-- See: https://github.com/neovim/neovim/issues/39032
--
-- Root cause: during async tree-sitter parsing, injection query matches can
-- reference TSNode userdata whose underlying C tree has been freed/reparsed.
-- Calling :range() on such a node errors. The crash manifests in two paths:
--   1. Decoration provider on_start -> parse -> get_range
--   2. vim.schedule callback -> step -> parse -> get_range
--
-- Fix: Patch vim.treesitter.get_range to return a zero range instead of
-- crashing when node:range() fails. This is safe because the highlighter
-- will re-parse and get correct ranges on the next redraw cycle.

local ts = vim.treesitter
local original_get_range = ts.get_range

---@diagnostic disable-next-line: duplicate-set-field
ts.get_range = function(node, source, metadata)
  if node == nil then
    return { 0, 0, 0, 0, 0, 0 }
  end

  local ok, result = pcall(original_get_range, node, source, metadata)
  if ok then
    return result
  end

  -- Return a zero-width range; the highlighter will correct on next redraw
  return { 0, 0, 0, 0, 0, 0 }
end
