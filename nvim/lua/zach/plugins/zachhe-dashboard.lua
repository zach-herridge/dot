return {
  "folke/snacks.nvim",
  opts = function(_, opts)
    -- Define highlight groups for celestial objects
    vim.api.nvim_set_hl(0, "AstroSun", { fg = "#f9e2af" })      -- Yellow
    vim.api.nvim_set_hl(0, "AstroVenus", { fg = "#f5f5f5" })    -- Bright white
    vim.api.nvim_set_hl(0, "AstroMars", { fg = "#f38ba8" })     -- Red
    vim.api.nvim_set_hl(0, "AstroJupiter", { fg = "#fab387" })  -- Orange
    vim.api.nvim_set_hl(0, "AstroSaturn", { fg = "#f9e2af" })   -- Yellow
    vim.api.nvim_set_hl(0, "AstroUranus", { fg = "#89dceb" })   -- Cyan
    vim.api.nvim_set_hl(0, "AstroNeptune", { fg = "#89b4fa" })  -- Blue
    vim.api.nvim_set_hl(0, "AstroMercury", { fg = "#cba6f7" })  -- Magenta
    vim.api.nvim_set_hl(0, "AstroBrightStar", { fg = "#f9e2af" }) -- Yellow
    vim.api.nvim_set_hl(0, "AstroMediumStar", { fg = "#89dceb" }) -- Cyan
    vim.api.nvim_set_hl(0, "AstroDimStar", { fg = "#89b4fa" })    -- Blue
    vim.api.nvim_set_hl(0, "AstroFaintStar", { fg = "#a6e3a1" }) -- Green
    vim.api.nvim_set_hl(0, "AstroLocation", { fg = "#89dceb" })   -- Cyan
    vim.api.nvim_set_hl(0, "AstroTime", { fg = "#f9e2af" })      -- Yellow

    local locations = {
      {name = "Mendota Heights", lat = 44.8836, lon = -93.1341, tz_offset = -6},  -- Minnesota, USA (CST)
      {name = "River Falls", lat = 44.8619, lon = -92.6238, tz_offset = -6},     -- Wisconsin, USA (CST)
      {name = "Kansas City", lat = 39.0997, lon = -94.5786, tz_offset = -6},     -- Missouri, USA (CST)
      {name = "Seattle", lat = 47.6062, lon = -122.3321, tz_offset = -8},        -- Washington, USA (PST)
      {name = "Boundary Waters", lat = 47.9500, lon = -91.5000, tz_offset = -6}, -- Minnesota, USA (CST)
      {name = "Amsterdam", lat = 52.3676, lon = 4.9041, tz_offset = 1},         -- Netherlands (CET)
      {name = "Tokyo", lat = 35.6762, lon = 139.6503, tz_offset = 9},           -- Japan (JST)
      {name = "Reykjavik", lat = 64.1466, lon = -21.9426, tz_offset = 0},       -- Iceland (GMT)
      {name = "Boston", lat = 42.3601, lon = -71.0589, tz_offset = -5},       -- Massachusetts, USA (EST)
      {name = "Anaheim", lat = 33.8366, lon = -117.9143, tz_offset = -8},     -- California, USA (PST)
      {name = "Afton Alps", lat = 44.9048, lon = -92.7982, tz_offset = -6},   -- Minnesota, USA (CST)
      {name = "Portland", lat = 47.6062, lon = -122.3321, tz_offset = -8},        -- Washington, USA (PST)
    }

    local function get_skyview()
      math.randomseed(os.time())
      local location = locations[math.random(#locations)]
      local skyview = require('zach.skyview.astronomy')
      local width, height = 80, 30
      local screen = skyview.generate_sky(location.lat, location.lon, width, height)

      local text_parts = {} ---@type snacks.dashboard.Text[]

      for y = 1, #screen do
        local line = table.concat(screen[y])
        local i = 1
        while i <= #line do
          local char = line:sub(i, i)
          local hl_group = nil

          -- Determine highlight group for character
          if char == "☉" then hl_group = "AstroSun"
          elseif char == "♀" then hl_group = "AstroVenus"
          elseif char == "♂" then hl_group = "AstroMars"
          elseif char == "♃" then hl_group = "AstroJupiter"
          elseif char == "♄" then hl_group = "AstroSaturn"
          elseif char == "⛢" then hl_group = "AstroUranus"
          elseif char == "♆" then hl_group = "AstroNeptune"
          elseif char == "☿" then hl_group = "AstroMercury"
          elseif char == "*" then hl_group = "AstroBrightStar"
          elseif char == "+" then hl_group = "AstroMediumStar"
          elseif char == "o" then hl_group = "AstroDimStar"
          elseif char == "." then hl_group = "AstroFaintStar"
          else
            -- Debug: color any unmatched character as red to see what we're missing
            if char ~= " " and char ~= "\n" then
              hl_group = "AstroMars" -- Temporary debug coloring
            end
          end

          if hl_group then
            table.insert(text_parts, { char, hl = hl_group })
          else
            table.insert(text_parts, { char })
          end
          i = i + 1
        end
        table.insert(text_parts, { "\n" })
      end

      -- Add location and time
      table.insert(text_parts, { "\n" })
      table.insert(text_parts, { location.name, hl = "AstroLocation" })
      table.insert(text_parts, { "\n" })

      -- Calculate local time
      local utc_time = os.time(os.date("!*t"))
      local local_time = utc_time + (location.tz_offset * 3600)
      local time_str = os.date("%l:%M %p", local_time)
      table.insert(text_parts, { time_str, hl = "AstroTime" })

      return text_parts
    end

    opts.dashboard = {
      sections = {
        {
          text = get_skyview(),
          align = "center"
        },
      }
    }

    -- Set up timer to update dashboard every minute
    local timer = vim.loop.new_timer()
    timer:start(60000, 60000, vim.schedule_wrap(function()
      -- Only update if dashboard is visible
      local buf = vim.api.nvim_get_current_buf()
      if vim.bo[buf].filetype == "snacks_dashboard" then
        require("snacks").dashboard.update()
      end
    end))

    return opts
  end,
}
