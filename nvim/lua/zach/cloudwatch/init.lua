local M = {}

local query = require('zach.cloudwatch.query')
local aws = require('zach.cloudwatch.aws')
local results = require('zach.cloudwatch.results')

M.config = {
  log_groups = {},
  default_time_range = "1h",
  result_format = "table"
}

function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})

  -- Set up .cwq filetype with targeted syntax highlighting
  vim.api.nvim_create_autocmd({ "BufRead", "BufNewFile" }, {
    pattern = "*.cwq",
    callback = function()
      vim.bo.filetype = "cwq"
      M.apply_cwq_highlighting()
      M.setup_cwq_keymaps()
    end,
  })

  vim.api.nvim_create_autocmd({ "TextChanged", "TextChangedI" }, {
    pattern = "*.cwq",
    callback = function()
      M.apply_cwq_highlighting()
    end,
  })
end

function M.setup_cwq_keymaps()
  vim.keymap.set('n', '<CR>', M.expand_row, { buffer = true, desc = "Expand row under cursor" })
end

function M.expand_row()
  local line = vim.api.nvim_get_current_line()
  
  -- Check if this is a data row (contains │)
  if not line:match("│") or line:match("^─") then
    return
  end
  
  -- Get current line number and find results section start
  local cursor_line = vim.fn.line('.')
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local results_start = nil
  
  for i, file_line in ipairs(lines) do
    if file_line == "=== RESULTS ===" then
      results_start = i
      break
    end
  end
  
  if not results_start then
    vim.notify("Results section not found", vim.log.levels.ERROR)
    return
  end
  
  -- Calculate relative line number within results section
  local relative_line = cursor_line - results_start
  
  -- Get filenames
  local cwq_filename = vim.fn.expand("%:p")
  local json_filename = cwq_filename:gsub("%.cwq$", ".json")
  local meta_filename = cwq_filename:gsub("%.cwq$", ".meta.json")
  
  -- Read metadata
  local meta_content = vim.fn.readfile(meta_filename)
  if #meta_content == 0 then
    vim.notify("No metadata found", vim.log.levels.ERROR)
    return
  end
  
  local metadata = vim.fn.json_decode(table.concat(meta_content, ""))
  local row_idx = metadata.row_mappings[tostring(relative_line)]
  
  if not row_idx then
    vim.notify("No row mapping found for relative line " .. relative_line, vim.log.levels.WARN)
    return
  end
  
  -- Read JSON data
  local json_content = vim.fn.readfile(json_filename)
  if #json_content == 0 then
    vim.notify("No JSON data found", vim.log.levels.ERROR)
    return
  end
  
  local data = vim.fn.json_decode(table.concat(json_content, ""))
  local row_data = data.results[row_idx]
  
  if not row_data then
    vim.notify("Row data not found", vim.log.levels.ERROR)
    return
  end
  
  -- Build expanded content from full JSON data
  local expanded = {}
  table.insert(expanded, "=== EXPANDED ROW " .. row_idx .. " ===")
  table.insert(expanded, "")
  
  for _, field in ipairs(row_data) do
    table.insert(expanded, field.field .. ":")
    -- Split long values and handle newlines
    local value = field.value or ""
    local lines = vim.split(value, '\n')
    for _, line in ipairs(lines) do
      if #line > 80 then
        for i = 1, #line, 80 do
          table.insert(expanded, "  " .. line:sub(i, i + 79))
        end
      else
        table.insert(expanded, "  " .. line)
      end
    end
    table.insert(expanded, "")
  end
  
  -- Show in floating window
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, expanded)
  
  local width = math.min(vim.o.columns - 4, 120)
  local height = math.min(#expanded, vim.o.lines - 4)
  
  vim.api.nvim_open_win(buf, true, {
    relative = 'editor',
    width = width,
    height = height,
    col = (vim.o.columns - width) / 2,
    row = (vim.o.lines - height) / 2,
    style = 'minimal',
    border = 'rounded',
    title = ' Expanded Row ' .. row_idx .. ' ',
    title_pos = 'center'
  })
  
  vim.keymap.set('n', 'q', '<cmd>close<cr>', { buffer = buf })
  vim.keymap.set('n', '<Esc>', '<cmd>close<cr>', { buffer = buf })
end

function M.apply_cwq_highlighting()
  local buf = vim.api.nvim_get_current_buf()
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)

  -- Clear existing highlights
  vim.api.nvim_buf_clear_namespace(buf, -1, 0, -1)

  local in_query = false
  for i, line in ipairs(lines) do
    local line_num = i - 1

    -- Highlight section headers
    if line:match("^=== .* ===$") then
      vim.api.nvim_buf_add_highlight(buf, -1, "Title", line_num, 0, -1)
      in_query = (line == "=== QUERY ===")
    elseif in_query and line:match("^=== ") then
      in_query = false
    elseif in_query then
      -- Highlight CloudWatch query syntax
      local keywords = { "fields", "sort", "limit", "filter", "stats", "parse" }
      for _, keyword in ipairs(keywords) do
        local start_pos = line:find(keyword)
        if start_pos then
          vim.api.nvim_buf_add_highlight(buf, -1, "Keyword", line_num, start_pos - 1, start_pos + #keyword - 1)
        end
      end

      -- Highlight @ fields
      for match in line:gmatch("@%w+") do
        local start_pos = line:find(match, 1, true)
        if start_pos then
          vim.api.nvim_buf_add_highlight(buf, -1, "Special", line_num, start_pos - 1, start_pos + #match - 1)
        end
      end

      -- Highlight pipes
      local start_pos = line:find("|")
      if start_pos then
        vim.api.nvim_buf_add_highlight(buf, -1, "Operator", line_num, start_pos - 1, start_pos)
      end
    end
  end
end

function M.execute_query()
  local query_text = query.extract_under_cursor()
  if not query_text then
    vim.notify("No CloudWatch query found under cursor", vim.log.levels.WARN)
    return
  end

  -- Check if we're already in a .cwq file
  local current_file = vim.fn.expand("%:p")
  local filename

  if current_file:match("%.cwq$") then
    -- Reuse existing file
    filename = current_file
    results.reset_file(filename, query_text)
  else
    -- Create new file
    filename = results.create_file(query_text)
  end

  results.update_status(filename, "Starting query...")

  aws.start_query(query_text, M.config, function(query_id)
    if query_id then
      results.update_status(filename, "Query running (ID: " .. query_id .. ")")
      aws.poll_results(query_id, filename, function(data)
        results.display_final(filename, data)
      end)
    else
      results.update_status(filename, "Failed to start query")
    end
  end)
end

return M
