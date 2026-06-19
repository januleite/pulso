// script.js - Weather Dashboard (OpenWeatherMap API key inserted)
const API_KEY = '16589f0f83ca1e0777f0c055ece3880e'; // OpenWeatherMap API key provided by user
const units = 'metric';
const lang = 'pt_br';

const $ = id => document.getElementById(id);
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const locationBtn = $('locationBtn');
const currentWeather = $('currentWeather');
const detailsGrid = $('detailsGrid');
const forecastSection = $('forecastSection');
const forecastGrid = $('forecastGrid');
const errorMessage = $('errorMessage');
const humidityEl = $('humidity');
const windSpeedEl = $('windSpeed');
const pressureEl = $('pressure');
const visibilityEl = $('visibility');

searchBtn.addEventListener('click', () => {
  const city = searchInput.value.trim();
  if (city) fetchWeatherByCity(city);
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchBtn.click();
});
locationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return showError('Geolocalização não é suportada neste navegador.');
  navigator.geolocation.getCurrentPosition((pos) => {
    fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
  }, (err) => showError('Não foi possível obter localização: ' + err.message));
});

function showError(msg) {
  errorMessage.style.display = 'block';
  errorMessage.textContent = msg;
}
function clearError() {
  errorMessage.style.display = 'none';
  errorMessage.textContent = '';
}

async function fetchWeatherByCity(city) {
  clearError();
  setLoading();
  try {
    const currentRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units}&lang=${lang}&appid=${API_KEY}`);
    if (!currentRes.ok) throw new Error('Cidade não encontrada');
    const currentData = await currentRes.json();
    const { coord } = currentData;
    await fetchAndRender(currentData, coord.lat, coord.lon);
  } catch (err) {
    setIdle();
    showError(err.message || 'Erro ao buscar dados');
  }
}

async function fetchWeatherByCoords(lat, lon) {
  clearError();
  setLoading();
  try {
    const currentRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&lang=${lang}&appid=${API_KEY}`);
    if (!currentRes.ok) throw new Error('Erro ao obter tempo atual');
    const currentData = await currentRes.json();
    await fetchAndRender(currentData, lat, lon);
  } catch (err) {
    setIdle();
    showError(err.message || 'Erro ao buscar dados por coordenadas');
  }
}

async function fetchAndRender(currentData, lat, lon) {
  try {
    const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&lang=${lang}&appid=${API_KEY}`);
    if (!forecastRes.ok) throw new Error('Erro ao obter previsão');
    const forecastData = await forecastRes.json();
    renderCurrent(currentData);
    renderDetails(currentData);
    renderForecast(forecastData.list);
  } catch (err) {
    showError(err.message || 'Erro ao carregar previsão');
  }
}

function setLoading() {
  currentWeather.innerHTML = '<div class="loading">Carregando dados...</div>';
  detailsGrid.style.display = 'none';
  forecastSection.style.display = 'none';
}
function setIdle() {
  currentWeather.innerHTML = '';
}

function renderCurrent(data) {
  const icon = data.weather[0].icon;
  const desc = capitalize(data.weather[0].description);
  const temp = Math.round(data.main.temp);
  const name = `${data.name}, ${data.sys.country}`;
  const html = `
    <div class="weather-main">
      <div class="weather-icon">
        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" />
      </div>
      <div class="weather-info">
        <div class="location-name">${name}</div>
        <div class="temp">${temp}°C</div>
        <div class="condition">${desc}</div>
      </div>
    </div>
  `;
  currentWeather.innerHTML = html;
}

function renderDetails(data) {
  detailsGrid.style.display = 'grid';
  humidityEl.textContent = `${data.main.humidity}%`;
  windSpeedEl.textContent = `${data.wind.speed} m/s`;
  pressureEl.textContent = `${data.main.pressure} hPa`;
  visibilityEl.textContent = `${(data.visibility / 1000).toFixed(1)} km`;
}

function renderForecast(list) {
  // Group forecast items by date (YYYY-MM-DD), choose item at 12:00:00 if present
  const byDate = new Map();
  for (const item of list) {
    const [date, time] = item.dt_txt.split(' ');
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(item);
  }
  const days = Array.from(byDate.keys()).slice(0, 6); // includes today; we'll skip today for 5-day if desired
  const cards = [];
  for (const date of days) {
    const items = byDate.get(date);
    // prefer 12:00:00
    let pick = items.find(i => i.dt_txt.endsWith('12:00:00')) || items[0];
    cards.push(pick);
  }
  // show next 5 days excluding current day if the first card is today
  // Build display list with up to 5 cards (skip the first if it's today)
  const todayStr = new Date().toISOString().slice(0,10);
  let displayCards = cards;
  if (cards.length && cards[0].dt_txt.startsWith(todayStr)) {
    displayCards = cards.slice(1, 6);
  } else {
    displayCards = cards.slice(0, 5);
  }

  forecastGrid.innerHTML = '';
  for (const c of displayCards) {
    const date = formatDate(c.dt_txt);
    const icon = c.weather[0].icon;
    const desc = capitalize(c.weather[0].description);
    const temp = Math.round(c.main.temp);
    const html = `
      <div class="forecast-card">
        <div class="forecast-date">${date}</div>
        <div class="forecast-icon"><img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" /></div>
        <div class="forecast-temp">${temp}°C</div>
        <div class="forecast-desc">${desc}</div>
      </div>
    `;
    forecastGrid.insertAdjacentHTML('beforeend', html);
  }
  forecastSection.style.display = 'block';
}

function formatDate(dt_txt) {
  const d = new Date(dt_txt);
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Optionally, try to load user's location on first open (comment out if undesired)
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition((pos) => {
    // do not auto-fetch if user hasn't allowed — this is optional
    // fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
  }, () => {});
}
