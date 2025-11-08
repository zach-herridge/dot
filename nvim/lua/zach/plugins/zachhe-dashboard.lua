return {
  "folke/snacks.nvim",
  opts = function(_, opts)
    local locations = {
      {name = "Mendota Heights", lat = 44.8836, lon = -93.1341, tz_offset = -6},  -- Minnesota, USA (CST)
      {name = "River Falls", lat = 44.8619, lon = -92.6238, tz_offset = -6},     -- Wisconsin, USA (CST)
      {name = "Kansas City", lat = 39.0997, lon = -94.5786, tz_offset = -6},     -- Missouri, USA (CST)
      {name = "Seattle", lat = 47.6062, lon = -122.3321, tz_offset = -8},        -- Washington, USA (PST)
      {name = "Boundary Waters", lat = 47.9500, lon = -91.5000, tz_offset = -6}, -- Minnesota, USA (CST)
      {name = "Amsterdam", lat = 52.3676, lon = 4.9041, tz_offset = 1},         -- Netherlands (CET)
      {name = "Tokyo", lat = 35.6762, lon = 139.6503, tz_offset = 9},           -- Japan (JST)
      {name = "Reykjavik", lat = 64.1466, lon = -21.9426, tz_offset = 0},       -- Iceland (GMT)
    }

    local function get_skyview()
      math.randomseed(os.time())
      local location = locations[math.random(#locations)]
      local skyview = require('zach.skyview.astronomy')
      local width, height = 80, 30
      local screen = skyview.generate_sky(location.lat, location.lon, width, height)
      
      local lines = {}
      for y = 1, #screen do
        table.insert(lines, table.concat(screen[y]))
      end
      
      table.insert(lines, "")
      table.insert(lines, location.name)
      
      -- Calculate local time (convert from UTC)
      local utc_time = os.time(os.date("!*t"))  -- Get UTC time
      local local_time = utc_time + (location.tz_offset * 3600)
      local time_str = os.date("%l:%M %p", local_time)
      
      table.insert(lines, time_str)
      
      return table.concat(lines, "\n")
    end

    opts.dashboard = {
      sections = {
        { text = get_skyview(), align = "center" },
      }
    }

    return opts
  end,
}
