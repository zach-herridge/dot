local M = {}

function M.start_query(query_text, config, callback)
  local end_time = os.time()
  local start_time = end_time - (3600) -- 1 hour ago
  
  local cmd
  if #config.log_groups == 0 then
    -- Use SOURCE logGroups syntax for all log groups
    local full_query = string.format(
      "SOURCE logGroups(namePrefix: [], class: \"STANDARD\") START=-3600s END=0s |\n%s",
      query_text
    )
    cmd = string.format(
      "aws logs start-query --region us-east-1 --start-time %d --end-time %d --query-string %s --output json",
      start_time, end_time, vim.fn.shellescape(full_query)
    )
  else
    local log_groups = table.concat(config.log_groups, " ")
    cmd = string.format(
      "aws logs start-query --region us-east-1 --log-group-names %s --start-time %d --end-time %d --query-string %s --output json",
      log_groups, start_time, end_time, vim.fn.shellescape(query_text)
    )
  end
  
  vim.fn.jobstart(cmd, {
    stdout_buffered = true,
    on_stdout = function(_, data)
      local output = table.concat(data, "")
      if output ~= "" then
        local ok, result = pcall(vim.json.decode, output)
        if ok and result.queryId then
          callback(result.queryId)
        else
          vim.notify("Failed to start query: " .. output, vim.log.levels.ERROR)
          callback(nil)
        end
      end
    end,
    on_stderr = function(_, data)
      local error_msg = table.concat(data, "")
      if error_msg ~= "" then
        vim.notify("AWS CLI error: " .. error_msg, vim.log.levels.ERROR)
        callback(nil)
      end
    end
  })
end

function M.poll_results(query_id, filename, callback)
  local timer = vim.loop.new_timer()
  local results_module = require('zach.cloudwatch.results')
  
  local function check_status()
    local cmd = string.format("aws logs get-query-results --region us-east-1 --query-id %s --output json", query_id)
    
    vim.fn.jobstart(cmd, {
      stdout_buffered = true,
      on_stdout = function(_, data)
        local output = table.concat(data, "")
        if output ~= "" then
          local ok, result = pcall(vim.json.decode, output)
          if ok then
            if result.status == "Complete" then
              timer:stop()
              timer:close()
              callback(result)
            elseif result.status == "Failed" then
              timer:stop()
              timer:close()
              results_module.update_status(filename, "Query failed")
            else
              -- Update status while running
              results_module.update_status(filename, "Query " .. (result.status or "running") .. "...")
            end
          end
        end
      end
    })
  end
  
  -- Poll every 2 seconds
  timer:start(0, 2000, vim.schedule_wrap(check_status))
end

return M
