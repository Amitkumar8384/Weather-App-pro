const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locBtn = document.getElementById("locBtn");
const statusMsg = document.getElementById("statusMsg");
const cityNameEl = document.getElementById("cityName");
const localTimeEl = document.getElementById("localTime");
const tempEl = document.getElementById("temp");
const conditionEl = document.getElementById("condition");
const weatherIconEl = document.getElementById("weatherIcon");
const unitCBtn = document.getElementById("unitC");
const unitFBtn = document.getElementById("unitF");
const themeOceanBtn = document.getElementById("themeOcean");
const themeSunsetBtn = document.getElementById("themeSunset");
const themeNeonBtn = document.getElementById("themeNeon");
const windEl = document.getElementById("wind");
const humidityEl = document.getElementById("humidity");
const feelsLikeEl = document.getElementById("feelsLike");
const forecastListEl = document.getElementById("forecastList");
const recentSearchesEl = document.getElementById("recentSearches");
const cityMapEl = document.getElementById("cityMap");
const globeFallbackEl = document.getElementById("globeFallback");
const aiPredictionEl = document.getElementById("aiPrediction");
const aiConfidenceEl = document.getElementById("aiConfidence");
const tempChartCanvas = document.getElementById("tempChart");
const rainChartCanvas = document.getElementById("rainChart");
const globeMapEl = document.getElementById("globeMap");
const rainCanvas = document.getElementById("rainCanvas");

const RECENT_KEY = "weather_recent_cities";
const THEME_KEY = "weather_theme";
const AUTO_REFRESH_MS = 10 * 60 * 1000;
const DEGREE = String.fromCharCode(176);
const UNIT_LABEL = { C: `${DEGREE}C`, F: "F" };

let activeQuery = null;
let tempUnit = "C";
let lastWeatherData = null;
let lastLocationLabel = "-";
let lastCoords = { lat: 28.6139, lon: 77.2090 };
let tempChart = null;
let rainChart = null;
let globe = null;

const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail"
};

const RAIN_STATE = {
  ctx: null,
  width: 0,
  height: 0,
  drops: [],
  running: true,
  intensity: 0
};

function applyTheme(theme) {
  const allowed = ["ocean", "sunset", "neon"];
  const nextTheme = allowed.includes(theme) ? theme : "ocean";
  document.body.classList.remove("theme-ocean", "theme-sunset", "theme-neon");
  document.body.classList.add(`theme-${nextTheme}`);
  localStorage.setItem(THEME_KEY, nextTheme);
  if (themeOceanBtn) themeOceanBtn.classList.toggle("active", nextTheme === "ocean");
  if (themeSunsetBtn) themeSunsetBtn.classList.toggle("active", nextTheme === "sunset");
  if (themeNeonBtn) themeNeonBtn.classList.toggle("active", nextTheme === "neon");
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "ocean";
  applyTheme(savedTheme);
}

function setStatus(message, type = "") {
  statusMsg.textContent = message;
  statusMsg.className = `message ${type}`.trim();
}

function formatDay(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function toFahrenheit(value) {
  return (value * 9) / 5 + 32;
}

function convertTemp(valueC) {
  return tempUnit === "C" ? valueC : toFahrenheit(valueC);
}

function formatTemperature(valueC) {
  return `${Math.round(convertTemp(valueC))}${UNIT_LABEL[tempUnit]}`;
}

function getWeatherIconClass(code) {
  if (code === 0 || code === 1) return "fa-solid fa-sun";
  if (code === 2) return "fa-solid fa-cloud-sun";
  if (code === 3) return "fa-solid fa-cloud";
  if (code === 45 || code === 48) return "fa-solid fa-smog";
  if (code >= 51 && code <= 67) return "fa-solid fa-cloud-rain";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "fa-solid fa-snowflake";
  if (code >= 80 && code <= 82) return "fa-solid fa-cloud-showers-heavy";
  if (code >= 95 && code <= 99) return "fa-solid fa-bolt";
  return "fa-solid fa-cloud";
}

function getWeatherThemeClass(code) {
  if (code === 0 || code === 1 || code === 2) return "weather-clear";
  if (code === 3) return "weather-cloudy";
  if (code === 45 || code === 48) return "weather-fog";
  if (code >= 51 && code <= 67) return "weather-rain";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "weather-snow";
  if (code >= 95 && code <= 99) return "weather-storm";
  if (code >= 80 && code <= 82) return "weather-rain";
  return "weather-cloudy";
}

function applyWeatherTheme(code) {
  document.body.classList.remove("weather-clear", "weather-cloudy", "weather-rain", "weather-snow", "weather-storm", "weather-fog");
  document.body.classList.add(getWeatherThemeClass(code));
}

function getRainIntensityByCode(code) {
  if (code >= 95 && code <= 99) return 1;
  if (code >= 80 && code <= 82) return 0.8;
  if (code >= 61 && code <= 67) return 0.65;
  if (code >= 51 && code <= 55) return 0.45;
  return 0;
}

function updateMap(lat, lon) {
  const delta = 0.25;
  const west = (lon - delta).toFixed(4);
  const east = (lon + delta).toFixed(4);
  const south = (lat - delta).toFixed(4);
  const north = (lat + delta).toFixed(4);
  const markerLat = Number(lat).toFixed(4);
  const markerLon = Number(lon).toFixed(4);
  cityMapEl.src = `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${markerLat}%2C${markerLon}`;
}

function saveRecentSearch(entry) {
  if (!entry || !entry.label) {
    return;
  }

  const existing = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
    .map((item) => (typeof item === "string" ? { label: item } : item));
  const next = [entry, ...existing.filter((item) => item.label?.toLowerCase() !== entry.label.toLowerCase())].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  renderRecentSearches();
}

function renderRecentSearches() {
  const cities = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
    .map((item) => (typeof item === "string" ? { label: item } : item));
  recentSearchesEl.innerHTML = "";

  if (!cities.length) {
    return;
  }

  cities.forEach((cityObj) => {
    const btn = document.createElement("button");
    btn.textContent = cityObj.label;
    btn.title = "Load this recent search";
    btn.addEventListener("click", async () => {
      if (typeof cityObj.lat === "number" && typeof cityObj.lon === "number") {
        await fetchByCoordinates(cityObj.lat, cityObj.lon, cityObj.label, false);
      } else {
        await fetchByCity(cityObj.label);
      }
    });
    recentSearchesEl.appendChild(btn);
  });
}

async function geocodeCity(city) {
  const geoURL = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await fetch(geoURL);
  if (!response.ok) {
    throw new Error("Geocoding API error");
  }

  const data = await response.json();
  if (!data.results || !data.results.length) {
    throw new Error("City not found");
  }

  const place = data.results[0];
  return {
    lat: place.latitude,
    lon: place.longitude,
    label: [place.name, place.admin1, place.country].filter(Boolean).join(", ")
  };
}

async function reverseGeocode(lat, lon) {
  const reverseURL = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`;
  const response = await fetch(reverseURL);
  if (!response.ok) {
    throw new Error("Reverse geocoding API error");
  }

  const data = await response.json();
  if (!data.results || !data.results.length) {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }

  const place = data.results[0];
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

async function fetchWeather(lat, lon) {
  const weatherURL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max&forecast_days=5&timezone=auto`;
  const response = await fetch(weatherURL);

  if (!response.ok) {
    throw new Error("Weather API error");
  }

  return response.json();
}

function renderCurrentWeather(data, locationLabel) {
  const current = data.current;
  const code = current.weather_code;
  const sunrise = data.daily.sunrise?.[0] ? data.daily.sunrise[0].split("T")[1] : "-";
  const sunset = data.daily.sunset?.[0] ? data.daily.sunset[0].split("T")[1] : "-";

  cityNameEl.textContent = locationLabel;
  localTimeEl.textContent = `Local time: ${current.time.replace("T", " ")} | Sunrise: ${sunrise} | Sunset: ${sunset}`;
  tempEl.textContent = formatTemperature(current.temperature_2m);
  conditionEl.textContent = `Condition: ${WEATHER_CODES[code] || "Unknown"}`;
  weatherIconEl.className = `${getWeatherIconClass(code)} weather-icon`;
  windEl.textContent = `${Math.round(current.wind_speed_10m)} km/h (${Math.round(current.wind_gusts_10m || 0)} gust)`;
  humidityEl.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  feelsLikeEl.textContent = `${formatTemperature(current.apparent_temperature)} | Rain ${current.precipitation ?? 0} mm`;
  applyWeatherTheme(code);
  updateRainAnimation(code);
}

function renderForecast(data) {
  forecastListEl.innerHTML = "";

  const days = data.daily.time;
  const maxTemps = data.daily.temperature_2m_max;
  const minTemps = data.daily.temperature_2m_min;
  const codes = data.daily.weather_code;

  for (let i = 0; i < days.length; i += 1) {
    const row = document.createElement("div");
    row.className = "forecast-item";

    const day = document.createElement("div");
    day.className = "day";
    day.textContent = formatDay(days[i]);

    const condition = document.createElement("div");
    condition.textContent = WEATHER_CODES[codes[i]] || "Unknown";

    const icon = document.createElement("i");
    icon.className = `${getWeatherIconClass(codes[i])} forecast-icon`;
    icon.setAttribute("aria-hidden", "true");

    const range = document.createElement("div");
    range.className = "range";
    range.textContent = `${formatTemperature(minTemps[i])} / ${formatTemperature(maxTemps[i])}`;

    row.appendChild(day);
    row.appendChild(condition);
    row.appendChild(icon);
    row.appendChild(range);
    forecastListEl.appendChild(row);
  }
}

function renderAiPrediction(data) {
  const minTemps = data.daily.temperature_2m_min;
  const maxTemps = data.daily.temperature_2m_max;
  const codes = data.daily.weather_code;
  const precipitation = data.daily.precipitation_sum || [];

  const firstAvg = (minTemps[0] + maxTemps[0]) / 2;
  const lastAvg = (minTemps[minTemps.length - 1] + maxTemps[maxTemps.length - 1]) / 2;
  const trend = lastAvg - firstAvg;
  const rainyDays = codes.filter((code) => code >= 51 || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)).length;
  const totalRain = precipitation.reduce((sum, item) => sum + (item || 0), 0);
  const confidence = Math.max(62, Math.min(94, 70 + rainyDays * 4 + Math.round(Math.abs(trend) * 1.5)));

  let trendText = "stable";
  if (trend > 1.2) trendText = "warming";
  if (trend < -1.2) trendText = "cooling";

  const rainText = rainyDays > 0 ? `${rainyDays} rainy day(s), around ${Math.round(totalRain)} mm total rain expected.` : "Low rain risk in coming days.";
  aiPredictionEl.textContent = `AI signal: ${trendText} pattern expected for next 5 days. ${rainText}`;
  aiConfidenceEl.textContent = `${confidence}%`;
}

function renderCharts(data) {
  if (typeof Chart === "undefined") {
    return;
  }

  const labels = data.daily.time.map((item) => formatDay(item));
  const minTemps = data.daily.temperature_2m_min.map((v) => Math.round(convertTemp(v)));
  const maxTemps = data.daily.temperature_2m_max.map((v) => Math.round(convertTemp(v)));
  const rain = (data.daily.precipitation_sum || []).map((v) => Math.round(v || 0));
  const windMax = (data.daily.wind_speed_10m_max || []).map((v) => Math.round(v || 0));

  if (tempChart) {
    tempChart.destroy();
  }
  if (rainChart) {
    rainChart.destroy();
  }

  tempChart = new Chart(tempChartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `Min (${UNIT_LABEL[tempUnit]})`,
          data: minTemps,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.25)",
          fill: true,
          tension: 0.35
        },
        {
          label: `Max (${UNIT_LABEL[tempUnit]})`,
          data: maxTemps,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.15)",
          fill: true,
          tension: 0.35
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#e2e8f0" } } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.18)" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.18)" } }
      }
    }
  });

  rainChart = new Chart(rainChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Rain (mm)",
          data: rain,
          backgroundColor: "rgba(14, 165, 233, 0.6)",
          borderRadius: 8
        },
        {
          label: "Wind Max (km/h)",
          data: windMax,
          type: "line",
          borderColor: "#a78bfa",
          backgroundColor: "rgba(167, 139, 250, 0.25)",
          fill: false,
          tension: 0.35
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#e2e8f0" } } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.18)" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.18)" } }
      }
    }
  });
}

function initGlobe() {
  if (typeof Globe === "undefined" || !globeMapEl) {
    if (globeFallbackEl) {
      globeFallbackEl.classList.add("show");
    }
    return;
  }
  try {
    globe = Globe()(globeMapEl)
      .backgroundColor("rgba(0,0,0,0)")
      .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-night.jpg")
      .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
      .showAtmosphere(true)
      .atmosphereColor("#7dd3fc")
      .atmosphereAltitude(0.2)
      .pointColor(() => "#22d3ee")
      .pointAltitude(0.08)
      .pointRadius(0.6)
      .ringColor(() => "rgba(34, 211, 238, 0.75)")
      .ringMaxRadius(5)
      .ringPropagationSpeed(2.2)
      .ringRepeatPeriod(950);
  } catch (error) {
    if (globeFallbackEl) {
      globeFallbackEl.classList.add("show");
    }
    return;
  }

  if (typeof THREE !== "undefined" && globe.globeMaterial) {
    const globeMaterial = globe.globeMaterial();
    globeMaterial.emissive = new THREE.Color("#0ea5e9");
    globeMaterial.emissiveIntensity = 0.16;
    globeMaterial.shininess = 1.2;
  }

  const controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.45;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  resizeGlobe();
  updateGlobePoint(lastCoords.lat, lastCoords.lon, "Delhi");
  if (globeFallbackEl) {
    globeFallbackEl.classList.remove("show");
  }
}

function updateGlobePoint(lat, lon, label) {
  if (!globe) {
    return;
  }
  const marker = { lat, lng: lon, size: 0.48, label };
  globe.pointsData([marker]);
  globe.ringsData([marker]);
  globe.pointOfView({ lat, lng: lon, altitude: 1.9 }, 1000);
}

function resizeGlobe() {
  if (!globe || !globeMapEl) {
    return;
  }
  globe.width(globeMapEl.clientWidth);
  globe.height(globeMapEl.clientHeight);
}

function setupRainCanvas() {
  if (!rainCanvas) {
    return;
  }
  RAIN_STATE.ctx = rainCanvas.getContext("2d");
  resizeRainCanvas();
  for (let i = 0; i < 160; i += 1) {
    RAIN_STATE.drops.push({
      x: Math.random() * RAIN_STATE.width,
      y: Math.random() * RAIN_STATE.height,
      len: 8 + Math.random() * 14,
      speed: 3 + Math.random() * 5
    });
  }
  requestAnimationFrame(drawRainFrame);
}

function resizeRainCanvas() {
  RAIN_STATE.width = window.innerWidth;
  RAIN_STATE.height = window.innerHeight;
  rainCanvas.width = RAIN_STATE.width;
  rainCanvas.height = RAIN_STATE.height;
}

function updateRainAnimation(code) {
  RAIN_STATE.intensity = getRainIntensityByCode(code);
  document.body.classList.toggle("rain-active", RAIN_STATE.intensity > 0);
}

function drawRainFrame() {
  if (!RAIN_STATE.ctx || !RAIN_STATE.running) {
    return;
  }
  const ctx = RAIN_STATE.ctx;
  ctx.clearRect(0, 0, RAIN_STATE.width, RAIN_STATE.height);

  if (RAIN_STATE.intensity > 0) {
    const dropsToDraw = Math.floor(RAIN_STATE.drops.length * RAIN_STATE.intensity);
    ctx.strokeStyle = "rgba(125, 211, 252, 0.45)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < dropsToDraw; i += 1) {
      const drop = RAIN_STATE.drops[i];
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 2, drop.y + drop.len);
      ctx.stroke();

      drop.y += drop.speed + RAIN_STATE.intensity * 4;
      if (drop.y > RAIN_STATE.height) {
        drop.y = -20;
        drop.x = Math.random() * RAIN_STATE.width;
      }
    }
  }

  requestAnimationFrame(drawRainFrame);
}

async function fetchByCoordinates(lat, lon, label, saveToRecent = false) {
  setStatus("Loading weather data...", "loading");

  try {
    const realLabel = label || (await reverseGeocode(lat, lon));
    const weatherData = await fetchWeather(lat, lon);
    lastWeatherData = weatherData;
    lastLocationLabel = realLabel;
    lastCoords = { lat, lon };

    renderCurrentWeather(weatherData, realLabel);
    renderForecast(weatherData);
    renderAiPrediction(weatherData);
    renderCharts(weatherData);
    updateMap(lat, lon);
    updateGlobePoint(lat, lon, realLabel);

    activeQuery = { lat, lon, label: realLabel, saveToRecent };
    if (saveToRecent) {
      saveRecentSearch({ label: realLabel, lat, lon });
    }
    setStatus(`Live data updated: ${weatherData.current.time.replace("T", " ")}`);
  } catch (error) {
    setStatus(error.message || "Unable to fetch weather.", "error");
  }
}

function updateUnitButtons() {
  unitCBtn.textContent = UNIT_LABEL.C;
  unitFBtn.textContent = UNIT_LABEL.F;
  unitCBtn.classList.toggle("active", tempUnit === "C");
  unitFBtn.classList.toggle("active", tempUnit === "F");
}

function setUnit(unit) {
  tempUnit = unit;
  updateUnitButtons();
  if (lastWeatherData) {
    renderCurrentWeather(lastWeatherData, lastLocationLabel);
    renderForecast(lastWeatherData);
    renderCharts(lastWeatherData);
  } else {
    tempEl.textContent = `--${UNIT_LABEL[tempUnit]}`;
  }
}

async function fetchByCity(city) {
  const value = city.trim();
  if (!value) {
    setStatus("Enter a city name first.", "error");
    return;
  }

  setStatus("Searching city...", "loading");

  try {
    const place = await geocodeCity(value);
    await fetchByCoordinates(place.lat, place.lon, place.label, true);
  } catch (error) {
    setStatus(error.message || "Unable to find city.", "error");
  }
}

function fetchFromBrowserLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported by this browser.", "error");
    return;
  }

  setStatus("Getting your location...", "loading");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      await fetchByCoordinates(lat, lon, "", false);
    },
    () => {
      setStatus("Location access denied.", "error");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function setupPwa() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        setStatus("PWA install not available in this mode.", "error");
      });
    });
  }
}

searchBtn.addEventListener("click", () => fetchByCity(cityInput.value));
cityInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    fetchByCity(cityInput.value);
  }
});
locBtn.addEventListener("click", fetchFromBrowserLocation);
unitCBtn.addEventListener("click", () => setUnit("C"));
unitFBtn.addEventListener("click", () => setUnit("F"));
if (themeOceanBtn) themeOceanBtn.addEventListener("click", () => applyTheme("ocean"));
if (themeSunsetBtn) themeSunsetBtn.addEventListener("click", () => applyTheme("sunset"));
if (themeNeonBtn) themeNeonBtn.addEventListener("click", () => applyTheme("neon"));
window.addEventListener("resize", () => {
  resizeRainCanvas();
  resizeGlobe();
});

initTheme();
renderRecentSearches();
updateUnitButtons();
setupRainCanvas();
initGlobe();
setupPwa();
fetchByCity("Delhi");
setInterval(() => {
  if (activeQuery) {
    fetchByCoordinates(activeQuery.lat, activeQuery.lon, activeQuery.label, activeQuery.saveToRecent);
  }
}, AUTO_REFRESH_MS);
