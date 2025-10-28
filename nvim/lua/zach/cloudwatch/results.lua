local M = {}

function M.create_file(query_text)
  -- Create scratch directory if it doesn't exist
  local scratch_dir = vim.fn.expand("~/scratch/cloudwatch")
  vim.fn.mkdir(scratch_dir, "p")
  
  -- Generate filename with timestamp and .cwq extension
  local timestamp = os.date("%Y%m%d_%H%M%S")
  local filename = string.format("%s/query_%s.cwq", scratch_dir, timestamp)
  
  -- Create initial file content with query in code block
  local lines = {}
  table.insert(lines, "=== QUERY ===")
  table.insert(lines, "```")
  for line in query_text:gmatch("[^\n]+") do
    table.insert(lines, line)
  end
  table.insert(lines, "```")
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
  table.insert(lines, "```")
  for line in query_text:gmatch("[^\n]+") do
    table.insert(lines, line)
  end
  table.insert(lines, "```")
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
  -- Read current file
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
    
    -- Add new results
    table.insert(lines, "Query Status: " .. (data.status or "Unknown"))
    table.insert(lines, "")
    
    -- Format statistics nicely
    if data.statistics then
      table.insert(lines, "Statistics:")
      table.insert(lines, "  Records Matched: " .. (data.statistics.recordsMatched or 0))
      table.insert(lines, "  Records Scanned: " .. (data.statistics.recordsScanned or 0))
      table.insert(lines, "  Bytes Scanned: " .. (data.statistics.bytesScanned or 0))
      table.insert(lines, "  Log Groups Scanned: " .. (data.statistics.logGroupsScanned or 0))
    end
    table.insert(lines, "")
    
    if data.results and #data.results > 0 then
      -- Get field names from first result
      local fields = {}
      if data.results[1] then
        for _, field in ipairs(data.results[1]) do
          table.insert(fields, field.field or "")
        end
        
        -- Header
        table.insert(lines, table.concat(fields, " | "))
        table.insert(lines, string.rep("-", 80))
        
        -- Data rows
        for _, result in ipairs(data.results) do
          local values = {}
          for _, field in ipairs(result) do
            local value = (field.value or ""):gsub("\n", " "):gsub("\r", "")
            table.insert(values, value)
          end
          table.insert(lines, table.concat(values, " | "))
        end
      end
    else
      table.insert(lines, "No results found")
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

return M
