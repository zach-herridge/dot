local M = {}

-- Default configuration
local config = {
  width = 80,
  height = 40,
  latitude = 48.0,  -- Minnesota Boundary Waters default
  longitude = -91.5,
}

-- Setup function for configuration
function M.setup(opts)
  config = vim.tbl_extend("force", config, opts or {})
end

-- Main function to generate and display sky view
function M.show_sky(lat, lon)
  lat = lat or config.latitude
  lon = lon or config.longitude
  
  local sky_data = require('zach.skyview.astronomy').generate_sky(lat, lon, config.width, config.height)
  require('zach.skyview.display').show_in_buffer(sky_data)
end

return M
