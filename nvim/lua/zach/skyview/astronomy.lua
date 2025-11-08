local M = {}

-- Load bright stars from extracted BSC5 data
local stars = require('zach.skyview.bright_stars')

-- Load planet data and calculations
local planets_module = require('zach.skyview.planets')

-- Convert degrees to radians
local function deg_to_rad(deg)
  return deg * math.pi / 180
end

-- Convert radians to degrees  
local function rad_to_deg(rad)
  return rad * 180 / math.pi
end

-- Get current Julian date
local function get_julian_date()
  local now = os.time()
  return (now / 86400) + 2440587.5
end

-- Convert RA/Dec to Alt/Az for given observer location and time (astroterm method)
local function radec_to_altaz(ra, dec, lat, lon, jd)
  -- Calculate Greenwich Mean Sidereal Time (simplified)
  local gmst = (jd - 2451545.0) / 36525 * 360.25 * math.pi / 180
  
  -- Convert to local sidereal time
  local lst = gmst + lon
  local ha = lst - deg_to_rad(ra)
  
  -- Normalize hour angle
  if ha < 0 then ha = ha + 2 * math.pi end
  if ha > math.pi then ha = ha - 2 * math.pi end
  
  -- Convert to radians
  dec = deg_to_rad(dec)
  lat = deg_to_rad(lat)
  
  -- Calculate altitude and azimuth (astroterm's method)
  local alt = math.asin(math.sin(lat) * math.sin(dec) + 
                       math.cos(lat) * math.cos(dec) * math.cos(ha))
  
  local az = math.atan2(math.sin(ha), 
                       math.cos(ha) * math.sin(lat) - math.tan(dec) * math.cos(lat))
  
  -- Make azimuth 0 at North (astroterm convention)
  az = az - math.pi
  if az < 0 then az = az + 2 * math.pi end
  
  return rad_to_deg(alt), rad_to_deg(az)
end

-- Convert horizontal coordinates to polar coordinates (astroterm method)
local function horizontal_to_polar(azimuth, altitude)
  -- Convert to spherical coordinates
  local theta_sphere = math.pi/2 - deg_to_rad(azimuth)
  local phi_sphere = math.pi/2 - deg_to_rad(altitude)
  
  -- Stereographic projection (astroterm's exact method)
  local c = math.abs(0.0 - phi_sphere)  -- Angular separation from north pole
  local radius_polar = math.tan(c / 2.0)  -- Sphere radius = 1.0
  local theta_polar = math.pi - theta_sphere
  
  return radius_polar, theta_polar
end

-- Convert polar coordinates to screen coordinates (astroterm method)
local function polar_to_screen(radius_polar, theta_polar, width, height)
  -- If outside projection, ignore (astroterm clips at radius > 1)
  if math.abs(radius_polar) > 1 then
    return nil, nil
  end
  
  local maxy = height - 1
  local maxx = width - 1
  
  local rad_y = maxy / 2.0
  local rad_x = maxx / 2.0
  
  -- astroterm's exact screen mapping
  local row_d = radius_polar * (-rad_y) * math.sin(theta_polar) + rad_y
  local col_d = radius_polar * rad_x * math.cos(theta_polar) + rad_x
  
  local row = math.floor(row_d + 0.5)  -- round
  local col = math.floor(col_d + 0.5)  -- round
  
  -- Check bounds
  if row < 0 or row >= height or col < 0 or col >= width then
    return nil, nil
  end
  
  return col + 1, row + 1  -- Convert to 1-based indexing
end

-- Generate sky view for given location
function M.generate_sky(lat, lon, width, height)
  local jd = get_julian_date()
  local screen = {}
  
  -- Initialize screen buffer
  for y = 1, height do
    screen[y] = {}
    for x = 1, width do
      screen[y][x] = ' '
    end
  end
  
  -- Filter to bright stars (magnitude < 4.5) for rich star field like astroterm
  local bright_stars = {}
  for _, star in ipairs(stars) do
    if star.mag < 3.5 then
      table.insert(bright_stars, star)
    end
  end
  
  -- Plot stars
  for _, star in ipairs(bright_stars) do
    local alt, az = radec_to_altaz(star.ra, star.dec, lat, lon, jd)
    
    if alt > 0 then  -- Only plot stars above horizon
      local radius_polar, theta_polar = horizontal_to_polar(az, alt)
      local x, y = polar_to_screen(radius_polar, theta_polar, width, height)
      
      if x and y then
        -- Choose character based on magnitude (like astroterm)
        local char = '.'
        if star.mag < -1 then char = '*'
        elseif star.mag < 0 then char = '*'
        elseif star.mag < 1 then char = '+'
        elseif star.mag < 2 then char = 'o'
        elseif star.mag < 3 then char = '.'
        else char = '.'
        end
        
        screen[y][x] = char
      end
    end
  end
  
  -- Plot planets
  for i, planet in ipairs(planets_module.planets) do
    local ra, dec = planets_module.calc_planet_geocentric_position(i, jd)
    local alt, az = radec_to_altaz(ra, dec, lat, lon, jd)
    
    if alt > 0 then  -- Only plot planets above horizon
      local radius_polar, theta_polar = horizontal_to_polar(az, alt)
      local x, y = polar_to_screen(radius_polar, theta_polar, width, height)
      
      if x and y then
        -- Use Unicode symbol if available, otherwise ASCII
        local char = planet.symbol or planet.ascii
        screen[y][x] = char
        
        -- Add planet label with collision detection
        local label = planet.name
        local can_place = true
        for j = 1, string.len(label) do
          if x + j <= width and screen[y][x + j] ~= ' ' and screen[y][x + j] ~= '.' and screen[y][x + j] ~= '+' and screen[y][x + j] ~= 'o' and screen[y][x + j] ~= '*' then
            can_place = false
            break
          end
        end
        
        if can_place then
          for j = 1, string.len(label) do
            if x + j <= width then
              screen[y][x + j] = string.sub(label, j, j)
            end
          end
        end
      end
    end
  end
  
  return screen
end

return M
