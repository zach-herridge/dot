local M = {}

function M.extract_under_cursor()
  local cursor_line = vim.fn.line('.')
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)

  -- Check if we're in a .cwq file
  local current_file = vim.fn.expand("%")
  if current_file:match("%.cwq$") then
    -- Extract query from === QUERY === section
    local in_query_section = false
    local in_code_block = false
    local query_lines = {}

    for i, line in ipairs(lines) do
      if line == "=== QUERY ===" then
        in_query_section = true
      elseif line:match("^=== ") and in_query_section then
        -- Hit another section, stop
        break
      elseif in_query_section and line == "```" then
        if in_code_block then
          -- End of code block
          break
        else
          -- Start of code block
          in_code_block = true
        end
      elseif in_query_section and in_code_block then
        -- Inside code block, collect lines
        if line:match("%S") then
          local clean_line = line:gsub("^%s+", ""):gsub("%s+$", "")
          if clean_line ~= "" then
            table.insert(query_lines, clean_line)
          end
        end
      end
    end

    if #query_lines > 0 then
      local query_text = table.concat(query_lines, "\n")
      if query_text:match("^fields%s") then
        return query_text
      end
    end

    vim.notify("No valid query found in .cwq file", vim.log.levels.WARN)
    return nil
  end

  -- Original code block extraction for other files
  local start_line, end_line = nil, nil

  -- Look backwards for opening ```
  for i = cursor_line, 1, -1 do
    if lines[i] and lines[i]:match("^```") then
      start_line = i + 1
      break
    end
  end

  -- Look forwards for closing ```
  if start_line then
    for i = cursor_line, #lines do
      if lines[i] and lines[i]:match("^```") and i > start_line - 1 then
        end_line = i - 1
        break
      end
    end
  end

  if not start_line or not end_line then
    return nil
  end

  -- Extract query text and clean it up
  local query_lines = {}
  for i = start_line, end_line do
    if lines[i] and lines[i]:match("%S") then -- Only non-empty lines
      -- Trim leading/trailing whitespace from each line
      local clean_line = lines[i]:gsub("^%s+", ""):gsub("%s+$", "")
      if clean_line ~= "" then
        table.insert(query_lines, clean_line)
      end
    end
  end

  if #query_lines == 0 then
    return nil
  end

  local query_text = table.concat(query_lines, "\n")

  -- Validate it looks like a CloudWatch query
  if not query_text:match("^fields%s") then
    vim.notify("Query must start with 'fields'", vim.log.levels.WARN)
    return nil
  end

  return query_text
end

return M
