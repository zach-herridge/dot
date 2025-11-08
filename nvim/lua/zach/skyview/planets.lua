local M = {}

-- Planet data with Keplerian orbital elements
-- From astroterm: https://ssd.jpl.nasa.gov/planets/approx_pos.html
M.planets = {
  {
    name = "Sun",
    symbol = "☉",
    ascii = "@",
    -- Sun position calculated differently (Earth's orbit inverted)
    elements = {a = 1.00000018, e = 0.01673163, I = -0.00054346, M = -2.46314313, w = 108.04266274, O = -5.11260389},
    rates = {da = -0.00000003, de = -0.00003661, dI = -0.01337178, dM = 35999.05511069, dw = 0.55919116, dO = -0.24123856}
  },
  {
    name = "Mercury",
    symbol = "☿",
    ascii = "*",
    elements = {a = 0.38709843, e = 0.20563661, I = 7.00559432, M = 174.79394829, w = 29.11810076, O = 48.33961819},
    rates = {da = 0.00000000, de = 0.00002123, dI = -0.00590158, dM = 149472.51546610, dw = 0.28154195, dO = -0.12214182}
  },
  {
    name = "Venus",
    symbol = "♀",
    ascii = "*",
    elements = {a = 0.72332102, e = 0.00676399, I = 3.39777545, M = 50.21215137, w = 55.09494217, O = 76.67261496},
    rates = {da = -0.00000026, de = -0.00005107, dI = 0.00043494, dM = 58517.75880612, dw = 0.32953822, dO = -0.27274174}
  },
  {
    name = "Mars",
    symbol = "♂",
    ascii = "*",
    elements = {a = 1.52371243, e = 0.09336511, I = 1.85181869, M = 19.34931620, w = -73.63065768, O = 49.71320984},
    rates = {da = 0.00000097, de = 0.00009149, dI = -0.00724757, dM = 19139.84710618, dw = 0.72076056, dO = -0.26852431}
  },
  {
    name = "Jupiter",
    symbol = "♃",
    ascii = "*",
    elements = {a = 5.20248019, e = 0.04853590, I = 1.29861416, M = 20.05983908, w = -86.01787410, O = 100.29282654},
    rates = {da = -0.00002864, de = 0.00018026, dI = -0.00322699, dM = 3034.72172561, dw = 0.05174577, dO = 0.13024619}
  },
  {
    name = "Saturn",
    symbol = "♄",
    ascii = "*",
    elements = {a = 9.54149883, e = 0.05550825, I = 2.49424102, M = -42.78564734, w = -20.77862639, O = 113.63998702},
    rates = {da = -0.00003065, de = -0.00032044, dI = 0.00451969, dM = 1221.57315246, dw = 0.79194480, dO = -0.25015002}
  },
  {
    name = "Uranus",
    symbol = "⛢",
    ascii = "*",
    elements = {a = 19.18797948, e = 0.04685740, I = 0.77298127, M = 141.76872184, w = 98.47154226, O = 73.96250215},
    rates = {da = -0.00020455, de = -0.00001550, dI = -0.00180155, dM = 428.40245610, dw = 0.03527286, dO = 0.05739699}
  },
  {
    name = "Neptune",
    symbol = "♆",
    ascii = "*",
    elements = {a = 30.06952752, e = 0.00895439, I = 1.77005520, M = 257.54130563, w = -85.10477129, O = 131.78635853},
    rates = {da = 0.00006447, de = 0.00000818, dI = 0.00022400, dM = 218.45505376, dw = 0.01616240, dO = -0.00606302}
  }
}

-- Convert degrees to radians
local function deg_to_rad(deg)
  return deg * math.pi / 180
end

-- Convert radians to degrees
local function rad_to_deg(rad)
  return rad * 180 / math.pi
end

-- Normalize angle to 0-360 degrees
local function normalize_angle(angle)
  while angle < 0 do angle = angle + 360 end
  while angle >= 360 do angle = angle - 360 end
  return angle
end

-- Solve Kepler's equation for eccentric anomaly
local function solve_kepler(M, e)
  local E = M
  for i = 1, 10 do -- Newton-Raphson iteration
    local dE = (E - e * math.sin(E) - M) / (1 - e * math.cos(E))
    E = E - dE
    if math.abs(dE) < 1e-6 then break end
  end
  return E
end

-- Calculate heliocentric position from Keplerian elements
function M.calc_planet_helio_position(elements, rates, jd)
  -- Time in centuries from J2000.0
  local T = (jd - 2451545.0) / 36525.0
  
  -- Update elements for current time
  local a = elements.a + rates.da * T
  local e = elements.e + rates.de * T
  local I = deg_to_rad(elements.I + rates.dI * T)
  local M = deg_to_rad(normalize_angle(elements.M + rates.dM * T))
  local w = deg_to_rad(elements.w + rates.dw * T)
  local O = deg_to_rad(elements.O + rates.dO * T)
  
  -- Solve Kepler's equation
  local E = solve_kepler(M, e)
  
  -- True anomaly
  local nu = 2 * math.atan2(math.sqrt(1 + e) * math.sin(E/2), math.sqrt(1 - e) * math.cos(E/2))
  
  -- Distance from Sun
  local r = a * (1 - e * math.cos(E))
  
  -- Position in orbital plane
  local x_orb = r * math.cos(nu)
  local y_orb = r * math.sin(nu)
  
  -- Rotate to ecliptic coordinates
  local cos_w, sin_w = math.cos(w), math.sin(w)
  local cos_O, sin_O = math.cos(O), math.sin(O)
  local cos_I, sin_I = math.cos(I), math.sin(I)
  
  local x_ecl = (cos_w * cos_O - sin_w * sin_O * cos_I) * x_orb + (-sin_w * cos_O - cos_w * sin_O * cos_I) * y_orb
  local y_ecl = (cos_w * sin_O + sin_w * cos_O * cos_I) * x_orb + (-sin_w * sin_O + cos_w * cos_O * cos_I) * y_orb
  local z_ecl = (sin_w * sin_I) * x_orb + (cos_w * sin_I) * y_orb
  
  return x_ecl, y_ecl, z_ecl
end

-- Convert ecliptic to equatorial coordinates (RA/Dec)
function M.ecliptic_to_equatorial(x_ecl, y_ecl, z_ecl, jd)
  -- Obliquity of ecliptic (simplified)
  local T = (jd - 2451545.0) / 36525.0
  local eps = deg_to_rad(23.43929111 - 0.0130042 * T)
  
  local cos_eps, sin_eps = math.cos(eps), math.sin(eps)
  
  -- Rotate from ecliptic to equatorial
  local x_eq = x_ecl
  local y_eq = cos_eps * y_ecl - sin_eps * z_ecl
  local z_eq = sin_eps * y_ecl + cos_eps * z_ecl
  
  -- Convert to RA/Dec
  local ra = math.atan2(y_eq, x_eq)
  local dec = math.atan2(z_eq, math.sqrt(x_eq*x_eq + y_eq*y_eq))
  
  -- Convert to degrees
  ra = rad_to_deg(ra)
  dec = rad_to_deg(dec)
  
  -- Normalize RA to 0-360
  if ra < 0 then ra = ra + 360 end
  
  return ra, dec
end

-- Calculate geocentric position (subtract Earth's position for other planets)
function M.calc_planet_geocentric_position(planet_idx, jd)
  local planet = M.planets[planet_idx]
  
  if planet.name == "Sun" then
    -- For Sun, use Earth's position but inverted
    local earth = M.planets[3] -- Earth is index 3 in astroterm, but we don't have it in our list
    -- Use simplified Sun position (opposite of Earth)
    local x_ecl, y_ecl, z_ecl = M.calc_planet_helio_position(planet.elements, planet.rates, jd)
    return M.ecliptic_to_equatorial(-x_ecl, -y_ecl, -z_ecl, jd)
  else
    -- For planets, subtract Earth's position
    local x_planet, y_planet, z_planet = M.calc_planet_helio_position(planet.elements, planet.rates, jd)
    
    -- Earth's position (we need to calculate this)
    local earth_elements = {a = 1.00000018, e = 0.01673163, I = -0.00054346, M = -2.46314313, w = 108.04266274, O = -5.11260389}
    local earth_rates = {da = -0.00000003, de = -0.00003661, dI = -0.01337178, dM = 35999.05511069, dw = 0.55919116, dO = -0.24123856}
    local x_earth, y_earth, z_earth = M.calc_planet_helio_position(earth_elements, earth_rates, jd)
    
    -- Geocentric position
    local x_geo = x_planet - x_earth
    local y_geo = y_planet - y_earth
    local z_geo = z_planet - z_earth
    
    return M.ecliptic_to_equatorial(x_geo, y_geo, z_geo, jd)
  end
end

return M
