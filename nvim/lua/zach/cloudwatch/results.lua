local M = {}

function M.create_file(query_text)
  -- Create scratch directory if it doesn't exist
  local scratch_dir = vim.fn.expand("~/scratch/cloudwatch")
  vim.fn.mkdir(scratch_dir, "p")

  -- Generate filename with timestamp and .cwq extension
  local timestamp = os.date("%Y%m%d_%H%M%S")
  local filename = string.format("%s/query_%s.cwq", scratch_dir, timestamp)

  -- Create initial file content
  local lines = {}
  table.insert(lines, "=== QUERY ===")
  for line in query_text:gmatch("[^\n]+") do
    table.insert(lines, line)
  end
  table.insert(lines, "")
  table.insert(lines, "=== STATUS ===")
  table.insert(lines, "Initializing...")
  table.insert(lines, "")
  table.insert(lines, "=== RESULTS ===")
  table.insert(lines, "(Results will appear here)")

  -- Write initial content
  vim.fn.writefile(lines, filename)

  -- Open the file
  vim.cmd("edit " .. filename)

  return filename
end

function M.reset_file(filename, query_text)
  -- Reset existing .cwq file for rerun
  local lines = {}
  table.insert(lines, "=== QUERY ===")
  for line in query_text:gmatch("[^\n]+") do
    table.insert(lines, line)
  end
  table.insert(lines, "")
  table.insert(lines, "=== STATUS ===")
  table.insert(lines, "Rerunning...")
  table.insert(lines, "")
  table.insert(lines, "=== RESULTS ===")
  table.insert(lines, "(Results will appear here)")

  -- Write content
  vim.fn.writefile(lines, filename)

  -- Refresh buffer
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_loaded(buf) then
      local buf_name = vim.api.nvim_buf_get_name(buf)
      if buf_name == filename then
        vim.api.nvim_buf_call(buf, function()
          vim.cmd("checktime")
        end)
        break
      end
    end
  end
end

function M.update_status(filename, status)
  -- Read current file
  local lines = vim.fn.readfile(filename)

  -- Find and update status line
  for i, line in ipairs(lines) do
    if line == "=== STATUS ===" and i < #lines then
      lines[i + 1] = status
      break
    end
  end

  -- Write back to file
  vim.fn.writefile(lines, filename)

  -- Refresh buffer if it's open
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_loaded(buf) then
      local buf_name = vim.api.nvim_buf_get_name(buf)
      if buf_name == filename then
        vim.api.nvim_buf_call(buf, function()
          vim.cmd("checktime")
        end)
        break
      end
    end
  end
end

function M.display_final(filename, data)
  -- Save raw data as JSON
  local json_filename = filename:gsub("%.cwq$", ".json")
  local json_string = vim.fn.json_encode(data)
  vim.fn.writefile({json_string}, json_filename)
  
  -- Save table metadata
  local meta_filename = filename:gsub("%.cwq$", ".meta.json")
  local table_lines, metadata = M.format_results_table_with_metadata(data)
  vim.fn.writefile({vim.fn.json_encode(metadata)}, meta_filename)

  -- Read current .cwq file
  local lines = vim.fn.readfile(filename)

  -- Find results section and replace it
  local results_start = nil
  for i, line in ipairs(lines) do
    if line == "=== RESULTS ===" then
      results_start = i
      break
    end
  end

  if results_start then
    -- Remove old results
    for i = #lines, results_start + 1, -1 do
      table.remove(lines, i)
    end

    -- Generate table from metadata
    for _, line in ipairs(table_lines) do
      table.insert(lines, line)
    end
  end

  -- Update status to complete
  for i, line in ipairs(lines) do
    if line == "=== STATUS ===" and i < #lines then
      lines[i + 1] = "Complete"
      break
    end
  end

  -- Write final results
  vim.fn.writefile(lines, filename)

  -- Refresh buffer
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_loaded(buf) then
      local buf_name = vim.api.nvim_buf_get_name(buf)
      if buf_name == filename then
        vim.api.nvim_buf_call(buf, function()
          vim.cmd("checktime")
        end)
        break
      end
    end
  end

  vim.notify("Query completed! Results in " .. filename)
end

function M.format_results_table(json_filename)
  local lines = {}

  -- Read JSON data as single line
  local json_content = vim.fn.readfile(json_filename)
  if #json_content == 0 then
    table.insert(lines, "No results found")
    return lines
  end

  local data = vim.fn.json_decode(table.concat(json_content, ""))

  -- Add status and statistics
  table.insert(lines, "Query Status: " .. (data.status or "Unknown"))
  table.insert(lines, "")

  if data.statistics then
    table.insert(lines, "Statistics:")
    table.insert(lines, "  Records Matched: " .. (data.statistics.recordsMatched or 0))
    table.insert(lines, "  Records Scanned: " .. (data.statistics.recordsScanned or 0))
    table.insert(lines, "  Bytes Scanned: " .. (data.statistics.bytesScanned or 0))
    table.insert(lines, "  Log Groups Scanned: " .. (data.statistics.logGroupsScanned or 0))
  end
  table.insert(lines, "")

  if data.results and #data.results > 0 then
    -- Collect all unique field names across all rows
    local all_fields = {}
    local field_set = {}

    for _, result in ipairs(data.results) do
      for _, field in ipairs(result) do
        if not field_set[field.field] then
          field_set[field.field] = true
          table.insert(all_fields, field.field)
        end
      end
    end

    -- Calculate column widths
    local col_widths = {}
    for _, field_name in ipairs(all_fields) do
      col_widths[field_name] = math.max(#field_name, 10)
    end

    -- Calculate max width for each column based on content
    for _, result in ipairs(data.results) do
      local row_data = {}
      for _, field in ipairs(result) do
        row_data[field.field] = field.value or ""
      end

      for field_name, value in pairs(row_data) do
        local clean_value = value:gsub("\n", " "):gsub("\r", "")
        if #clean_value > col_widths[field_name] then
          col_widths[field_name] = math.min(#clean_value, 50)
        end
      end
    end

    -- Create header
    local header_parts = {}
    for _, field_name in ipairs(all_fields) do
      table.insert(header_parts, string.format("%-" .. col_widths[field_name] .. "s", field_name))
    end
    table.insert(lines, table.concat(header_parts, " │ "))

    -- Create separator
    local sep_parts = {}
    for _, field_name in ipairs(all_fields) do
      table.insert(sep_parts, string.rep("─", col_widths[field_name]))
    end
    table.insert(lines, table.concat(sep_parts, "─┼─"))

    -- Data rows
    for row_idx, result in ipairs(data.results) do
      -- Convert row to field map
      local row_data = {}
      for _, field in ipairs(result) do
        row_data[field.field] = field.value or ""
      end

      local row_parts = {}
      for _, field_name in ipairs(all_fields) do
        local value = row_data[field_name] or ""
        local clean_value = value:gsub("\n", " "):gsub("\r", "")
        if #clean_value > 50 then
          clean_value = clean_value:sub(1, 47) .. "..."
        end
        table.insert(row_parts, string.format("%-" .. col_widths[field_name] .. "s", clean_value))
      end
      table.insert(lines, table.concat(row_parts, " │ "))
    end
  else
    table.insert(lines, "No results found")
  end

  return lines
end

function M.format_results_table_with_metadata(data)
  local lines = {}
  local metadata = {
    row_mappings = {},
    header_line = nil,
    separator_line = nil
  }
  
  -- Add status and statistics
  table.insert(lines, "Query Status: " .. (data.status or "Unknown"))
  table.insert(lines, "")
  
  if data.statistics then
    table.insert(lines, "Statistics:")
    table.insert(lines, "  Records Matched: " .. (data.statistics.recordsMatched or 0))
    table.insert(lines, "  Records Scanned: " .. (data.statistics.recordsScanned or 0))
    table.insert(lines, "  Bytes Scanned: " .. (data.statistics.bytesScanned or 0))
    table.insert(lines, "  Log Groups Scanned: " .. (data.statistics.logGroupsScanned or 0))
  end
  table.insert(lines, "")
  
  if data.results and #data.results > 0 then
    -- Collect all unique field names across all rows
    local all_fields = {}
    local field_set = {}
    
    for _, result in ipairs(data.results) do
      for _, field in ipairs(result) do
        if not field_set[field.field] then
          field_set[field.field] = true
          table.insert(all_fields, field.field)
        end
      end
    end
    
    -- Calculate column widths
    local col_widths = {}
    for _, field_name in ipairs(all_fields) do
      col_widths[field_name] = math.max(#field_name, 10)
    end
    
    -- Calculate max width for each column based on content
    for _, result in ipairs(data.results) do
      local row_data = {}
      for _, field in ipairs(result) do
        row_data[field.field] = field.value or ""
      end
      
      for field_name, value in pairs(row_data) do
        local clean_value = value:gsub("\n", " "):gsub("\r", "")
        if #clean_value > col_widths[field_name] then
          col_widths[field_name] = math.min(#clean_value, 50)
        end
      end
    end
    
    -- Create header
    local header_parts = {}
    for _, field_name in ipairs(all_fields) do
      table.insert(header_parts, string.format("%-" .. col_widths[field_name] .. "s", field_name))
    end
    table.insert(lines, table.concat(header_parts, " │ "))
    metadata.header_line = #lines
    
    -- Create separator
    local sep_parts = {}
    for _, field_name in ipairs(all_fields) do
      table.insert(sep_parts, string.rep("─", col_widths[field_name]))
    end
    table.insert(lines, table.concat(sep_parts, "─┼─"))
    metadata.separator_line = #lines
    
    -- Data rows
    for row_idx, result in ipairs(data.results) do
      -- Convert row to field map
      local row_data = {}
      for _, field in ipairs(result) do
        row_data[field.field] = field.value or ""
      end
      
      local row_parts = {}
      for _, field_name in ipairs(all_fields) do
        local value = row_data[field_name] or ""
        local clean_value = value:gsub("\n", " "):gsub("\r", "")
        if #clean_value > 50 then
          clean_value = clean_value:sub(1, 47) .. "..."
        end
        table.insert(row_parts, string.format("%-" .. col_widths[field_name] .. "s", clean_value))
      end
      table.insert(lines, table.concat(row_parts, " │ "))
      
      -- Track which line corresponds to which row in the JSON
      metadata.row_mappings[tostring(#lines)] = row_idx
    end
  else
    table.insert(lines, "No results found")
  end
  
  return lines, metadata
end

return M
