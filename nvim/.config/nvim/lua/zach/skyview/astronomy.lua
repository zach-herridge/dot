local M = {}

local stars = require('zach.skyview.bright_stars')

local planets_module = require('zach.skyview.planets')

local function deg_to_rad(deg)
  return deg * math.pi / 180
end

local function rad_to_deg(rad)
  return rad * 180 / math.pi
end

local function get_julian_date()
  local now = os.time()
  return (now / 86400) + 2440587.5
end

local function radec_to_altaz(ra, dec, lat, lon, jd)
  local gmst = (jd - 2451545.0) / 36525 * 360.25 * math.pi / 180

  local lst = gmst + lon
  local ha = lst - deg_to_rad(ra)

  if ha < 0 then ha = ha + 2 * math.pi end
  if ha > math.pi then ha = ha - 2 * math.pi end

  dec = deg_to_rad(dec)
  lat = deg_to_rad(lat)

  local alt = math.asin(math.sin(lat) * math.sin(dec) +
                       math.cos(lat) * math.cos(dec) * math.cos(ha))

  local az = math.atan2(math.sin(ha),
                       math.cos(ha) * math.sin(lat) - math.tan(dec) * math.cos(lat))

  az = az - math.pi
  if az < 0 then az = az + 2 * math.pi end

  return rad_to_deg(alt), rad_to_deg(az)
end

local function horizontal_to_polar(azimuth, altitude)
  local theta_sphere = math.pi/2 - deg_to_rad(azimuth)
  local phi_sphere = math.pi/2 - deg_to_rad(altitude)

  local c = math.abs(0.0 - phi_sphere)
  local radius_polar = math.tan(c / 2.0)
  local theta_polar = math.pi - theta_sphere

  return radius_polar, theta_polar
end

local function polar_to_screen(radius_polar, theta_polar, width, height)
  if math.abs(radius_polar) > 1 then
    return nil, nil
  end

  local maxy = height - 1
  local maxx = width - 1

  local rad_y = maxy / 2.0
  local rad_x = maxx / 2.0

  local row_d = radius_polar * (-rad_y) * math.sin(theta_polar) + rad_y
  local col_d = radius_polar * rad_x * math.cos(theta_polar) + rad_x

  local row = math.floor(row_d + 0.5)
  local col = math.floor(col_d + 0.5)

  if row < 0 or row >= height or col < 0 or col >= width then
    return nil, nil
  end

  return col + 1, row + 1  -- Convert to 1-based indexing
end

function M.generate_sky(lat, lon, width, height)
  local jd = get_julian_date()
  local screen = {}

  for y = 1, height do
    screen[y] = {}
    for x = 1, width do
      screen[y][x] = ' '
    end
  end

  local bright_stars = {}
  for _, star in ipairs(stars) do
    if star.mag < 3.5 then
      table.insert(bright_stars, star)
    end
  end

  for _, star in ipairs(bright_stars) do
    local alt, az = radec_to_altaz(star.ra, star.dec, lat, lon, jd)

    if alt > 0 then
      local radius_polar, theta_polar = horizontal_to_polar(az, alt)
      local x, y = polar_to_screen(radius_polar, theta_polar, width, height)

      if x and y then
        local char = '.'
        if star.mag < 1 then char = '*'
        elseif star.mag < 2 then char = '+'
        elseif star.mag < 3 then char = 'o'
        else char = '.'
        end

        screen[y][x] = char
      end
    end
  end

  local planets_plotted = 0
  for i, planet in ipairs(planets_module.planets) do
    local success, ra, dec = pcall(planets_module.calc_planet_geocentric_position, i, jd)
    if success and ra and dec then
      local alt, az = radec_to_altaz(ra, dec, lat, lon, jd)

      if alt > 0 then
        local radius_polar, theta_polar = horizontal_to_polar(az, alt)
        local x, y = polar_to_screen(radius_polar, theta_polar, width, height)

        if x and y then
          local char = planet.symbol or planet.ascii
          screen[y][x] = char

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

          planets_plotted = planets_plotted + 1
        end
      end
    end
  end

  return screen
end

return M
