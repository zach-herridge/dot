local M = {}

function M.extract_under_cursor()
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local current_file = vim.fn.expand("%")
  
  if current_file:match("%.cwq$") then
    -- Extract query between === QUERY === and === STATUS ===
    local in_query_section = false
    local query_lines = {}

    for _, line in ipairs(lines) do
      if line == "=== QUERY ===" then
        in_query_section = true
      elseif line == "=== STATUS ===" and in_query_section then
        break
      elseif in_query_section and line:match("%S") then
        table.insert(query_lines, line)
      end
    end

    if #query_lines > 0 then
      return table.concat(query_lines, "\n")
    end

    vim.notify("No valid query found in .cwq file", vim.log.levels.WARN)
    return nil
  end

  vim.notify("Not in a .cwq file", vim.log.levels.WARN)
  return nil
end

return M
