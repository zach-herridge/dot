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
