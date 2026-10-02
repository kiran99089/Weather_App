const APIKey = '99216c9a9c3fa73b24b41997c2aa8b8f';

// Application State
let currentUnit = 'C'; // 'C' or 'F'
let currentWeatherData = null;
let currentForecastData = null;
let lastLocationRef = { query: 'London', lat: null, lon: null, title: null, subtitle: null };
let debounceTimer = null;
let autoSyncInterval = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const refreshBtn = document.getElementById('refreshBtn');
const suggestionsBox = document.getElementById('suggestionsBox');
const loader = document.getElementById('loader');
const errorDiv = document.getElementById('errorDiv');
const errorMessage = document.getElementById('errorMessage');
const dashboardContent = document.getElementById('dashboardContent');

const cityName = document.getElementById('cityName');
const locationSubtitle = document.getElementById('locationSubtitle');
const weatherIcon = document.getElementById('weatherIcon');
const temperatureVal = document.getElementById('temperatureVal');
const activeUnitLabel = document.getElementById('activeUnitLabel');
const description = document.getElementById('description');
const feelsLikeVal = document.getElementById('feelsLikeVal');
const tempMaxVal = document.getElementById('tempMaxVal');
const tempMinVal = document.getElementById('tempMinVal');
const sunriseVal = document.getElementById('sunriseVal');
const sunsetVal = document.getElementById('sunsetVal');

const humidityVal = document.getElementById('humidityVal');
const humidityDesc = document.getElementById('humidityDesc');
const windVal = document.getElementById('windVal');
const windDesc = document.getElementById('windDesc');
const pressureVal = document.getElementById('pressureVal');
const visibilityVal = document.getElementById('visibilityVal');
const visibilityDesc = document.getElementById('visibilityDesc');
const uvVal = document.getElementById('uvVal');
const uvDesc = document.getElementById('uvDesc');
const rainVal = document.getElementById('rainVal');
const rainDesc = document.getElementById('rainDesc');

const hourlyForecastContainer = document.getElementById('hourlyForecastContainer');
const dailyForecastContainer = document.getElementById('dailyForecastContainer');
const currentDateBadge = document.getElementById('currentDateBadge');

const btnC = document.getElementById('btnC');
const btnF = document.getElementById('btnF');
const clockTime = document.getElementById('clockTime');
const cityChips = document.querySelectorAll('.city-chip');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    startLiveClock();
    setDateBadge();
    setupAutoSync();

    // Default search or load last searched location
    const savedLocation = localStorage.getItem('lastSearchedLocation') || 'London';
    searchWeather(savedLocation);
});

// Live Clock Routine
function startLiveClock() {
    function updateClock() {
        const now = new Date();
        clockTime.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function setDateBadge() {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    currentDateBadge.innerText = now.toLocaleDateString('en-US', options);
}

// Auto-Sync Data every 5 minutes
function setupAutoSync() {
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    autoSyncInterval = setInterval(() => {
        if (lastLocationRef) {
            refreshCurrentWeather();
        }
    }, 5 * 60 * 1000);
}

refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => { refreshBtn.style.transform = ''; }, 600);
    refreshCurrentWeather();
});

function refreshCurrentWeather() {
    if (lastLocationRef.lat && lastLocationRef.lon) {
        fetchRealtimeWeather(lastLocationRef.lat, lastLocationRef.lon, lastLocationRef.title, lastLocationRef.subtitle);
    } else if (lastLocationRef.query) {
        searchWeather(lastLocationRef.query);
    }
}

// Temperature Unit Toggle
btnC.addEventListener('click', () => setUnit('C'));
btnF.addEventListener('click', () => setUnit('F'));

function setUnit(unit) {
    if (currentUnit === unit) return;
    currentUnit = unit;
    
    if (unit === 'C') {
        btnC.classList.add('active');
        btnF.classList.remove('active');
        activeUnitLabel.innerText = '°C';
    } else {
        btnF.classList.add('active');
        btnC.classList.remove('active');
        activeUnitLabel.innerText = '°F';
    }

    if (currentWeatherData) {
        renderAllWeather();
    }
}

function formatTemp(celsiusVal) {
    if (celsiusVal === undefined || celsiusVal === null) return '--';
    if (currentUnit === 'F') {
        return Math.round((celsiusVal * 9) / 5 + 32) + '°F';
    }
    return Math.round(celsiusVal) + '°C';
}

function formatTempNum(celsiusVal) {
    if (celsiusVal === undefined || celsiusVal === null) return '--';
    if (currentUnit === 'F') {
        return Math.round((celsiusVal * 9) / 5 + 32);
    }
    return Math.round(celsiusVal);
}

// Search Event Handlers
searchBtn.addEventListener('click', handleSearchSubmit);

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        suggestionsBox.classList.remove('show');
        handleSearchSubmit();
    }
});

// Autocomplete Live Search
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 2) {
        suggestionsBox.classList.remove('show');
        suggestionsBox.innerHTML = '';
        return;
    }

    debounceTimer = setTimeout(() => {
        fetchSuggestions(query);
    }, 250);
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.classList.remove('show');
    }
});

cityChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const city = chip.getAttribute('data-city');
        searchInput.value = city;
        suggestionsBox.classList.remove('show');
        searchWeather(city);
    });
});

// GPS Geolocation Handler
locationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser.');
        return;
    }

    showLoader();
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            // Reverse Geocode via Nominatim to get exact village/town/city name
            try {
                const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`, {
                    headers: { 'User-Agent': 'AetherWeatherApp/2.0' }
                });
                const revData = await revRes.json();
                const addr = revData.address || {};
                const name = addr.village || addr.town || addr.hamlet || addr.suburb || addr.city || 'Your Location';
                const subtitle = [addr.county || addr.state_district || addr.state, addr.country].filter(Boolean).join(', ');
                
                fetchRealtimeWeather(lat, lon, name, subtitle);
            } catch (e) {
                fetchRealtimeWeather(lat, lon, 'Your Location', 'GPS Coordinates');
            }
        },
        (err) => {
            showError('Unable to retrieve your location. Please grant GPS permission or type a city/village name.');
        }
    );
});

function handleSearchSubmit() {
    const query = searchInput.value.trim();
    if (query === '') return;
    searchWeather(query);
}

// Multi-Geocoder Suggestions API
async function fetchSuggestions(query) {
    try {
        let results = [];

        // Provider 1: Open-Meteo Geocoding
        const omRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        const omData = await omRes.json();

        if (omData.results && omData.results.length > 0) {
            omData.results.forEach(item => {
                const sub = [item.admin1, item.country].filter(Boolean).join(', ');
                results.push({
                    name: item.name,
                    subtitle: sub,
                    lat: item.latitude,
                    lon: item.longitude
                });
            });
        }

        // Provider 2: Nominatim OpenStreetMap (for tiny villages and rural hamlets)
        if (results.length < 3) {
            try {
                const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`, {
                    headers: { 'User-Agent': 'AetherWeatherApp/2.0' }
                });
                const nomData = await nomRes.json();

                if (nomData && nomData.length > 0) {
                    nomData.forEach(item => {
                        const addr = item.address || {};
                        const placeName = addr.village || addr.town || addr.hamlet || addr.suburb || addr.city || item.name;
                        const sub = [addr.county || addr.state_district || addr.state, addr.country].filter(Boolean).join(', ');
                        
                        // Avoid duplicates
                        if (!results.some(r => Math.abs(r.lat - parseFloat(item.lat)) < 0.05 && Math.abs(r.lon - parseFloat(item.lon)) < 0.05)) {
                            results.push({
                                name: placeName,
                                subtitle: sub,
                                lat: parseFloat(item.lat),
                                lon: parseFloat(item.lon)
                            });
                        }
                    });
                }
            } catch (e) {
                console.warn('Nominatim suggestion fallback error:', e);
            }
        }

        if (results.length === 0) {
            suggestionsBox.classList.remove('show');
            suggestionsBox.innerHTML = '';
            return;
        }

        suggestionsBox.innerHTML = '';
        results.slice(0, 6).forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <i class="bi bi-geo-alt-fill"></i>
                <div>
                    <span class="item-title">${item.name}</span>
                    <span class="item-sub">${item.subtitle || 'Global Location'}</span>
                </div>
            `;
            li.addEventListener('click', () => {
                searchInput.value = item.name;
                suggestionsBox.classList.remove('show');
                fetchRealtimeWeather(item.lat, item.lon, item.name, item.subtitle);
            });
            suggestionsBox.appendChild(li);
        });

        suggestionsBox.classList.add('show');
    } catch (err) {
        console.error('Error fetching suggestions:', err);
    }
}

// Multi-Geocoder Location Search Engine
async function searchWeather(query) {
    showLoader();
    localStorage.setItem('lastSearchedLocation', query);

    try {
        // Step 1: Open-Meteo Geocoding
        const omGeoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
        const omGeoRes = await fetch(omGeoUrl);
        const omGeoData = await omGeoRes.json();

        if (omGeoData.results && omGeoData.results.length > 0) {
            const place = omGeoData.results[0];
            const stateCountry = [place.admin1, place.country].filter(Boolean).join(', ');
            await fetchRealtimeWeather(place.latitude, place.longitude, place.name, stateCountry);
            return;
        }

        // Step 2: OpenStreetMap Nominatim (for obscure villages, panchayats, small hamlets)
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`;
        const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'AetherWeatherApp/2.0' } });
        const nomData = await nomRes.json();

        if (nomData && nomData.length > 0) {
            const item = nomData[0];
            const addr = item.address || {};
            const placeName = addr.village || addr.town || addr.hamlet || addr.suburb || addr.city || item.name;
            const stateCountry = [addr.county || addr.state_district || addr.state, addr.country].filter(Boolean).join(', ');
            
            await fetchRealtimeWeather(parseFloat(item.lat), parseFloat(item.lon), placeName, stateCountry);
            return;
        }

        // Step 3: OpenWeatherMap Direct City Fallback
        const owmUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&units=metric&appid=${APIKey}`;
        const owmRes = await fetch(owmUrl);
        const owmJson = await owmRes.json();

        if (owmRes.ok && owmJson.cod === 200) {
            const countryName = owmJson.sys && owmJson.sys.country ? getCountryName(owmJson.sys.country) : '';
            await fetchRealtimeWeather(owmJson.coord.lat, owmJson.coord.lon, owmJson.name, countryName);
            return;
        }

        showError(`Could not locate weather data for "${query}". Please verify the location spelling.`);
    } catch (err) {
        console.error('Search location error:', err);
        showError('Network error while searching location. Please check your internet connection.');
    }
}

// Master High-Resolution Realtime Weather Fetcher
async function fetchRealtimeWeather(lat, lon, title, subtitle) {
    showLoader();
    lastLocationRef = { query: null, lat, lon, title, subtitle };

    try {
        // Open-Meteo High-Resolution Realtime Forecast API
        const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum&timezone=auto`;
        
        const [omRes, owmRes] = await Promise.allSettled([
            fetch(omUrl),
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${APIKey}`)
        ]);

        let omData = null;
        if (omRes.status === 'fulfilled' && omRes.value.ok) {
            omData = await omRes.value.json();
        }

        let owmData = null;
        if (owmRes.status === 'fulfilled' && owmRes.value.ok) {
            owmData = await owmRes.value.json();
        }

        if (omData && omData.current) {
            currentWeatherData = buildCombinedCurrent(omData, owmData, title, subtitle);
            currentForecastData = buildCombinedForecast(omData);
            renderAllWeather();
        } else if (owmData) {
            currentWeatherData = parseOWMCurrent(owmData, title, subtitle);
            await fetchOWMForecastFallback(lat, lon);
            renderAllWeather();
        } else {
            showError('Unable to fetch realtime weather data for this location.');
        }
    } catch (err) {
        console.error('Realtime weather fetch error:', err);
        showError('Error loading weather report.');
    }
}

// Build Consolidated Realtime Weather Object
function buildCombinedCurrent(omData, owmData, title, subtitle) {
    const cur = omData.current;
    const daily = omData.daily || {};
    const cond = mapWmoCodeToCondition(cur.weather_code);

    const windDir = getWindDirectionText(cur.wind_direction_10m);
    const uvMax = daily.uv_index_max ? daily.uv_index_max[0] : 0;
    const precipSum = daily.precipitation_sum ? daily.precipitation_sum[0] : 0;

    const sunrise = daily.sunrise ? formatIsoTime(daily.sunrise[0]) : (owmData ? formatTime(owmData.sys.sunrise * 1000) : '--:--');
    const sunset = daily.sunset ? formatIsoTime(daily.sunset[0]) : (owmData ? formatTime(owmData.sys.sunset * 1000) : '--:--');

    return {
        name: title,
        subtitle: subtitle,
        tempC: cur.temperature_2m,
        feelsLikeC: cur.apparent_temperature,
        tempMinC: daily.temperature_2m_min ? daily.temperature_2m_min[0] : cur.temperature_2m,
        tempMaxC: daily.temperature_2m_max ? daily.temperature_2m_max[0] : cur.temperature_2m,
        humidity: cur.relative_humidity_2m,
        windSpeed: Math.round(cur.wind_speed_10m),
        windDirection: windDir,
        pressure: Math.round(cur.surface_pressure || (owmData ? owmData.main.pressure : 1013)),
        visibility: owmData && owmData.visibility ? (owmData.visibility / 1000).toFixed(1) : 10,
        uvIndex: uvMax ? Math.round(uvMax) : 0,
        rainProbability: precipSum > 0 ? Math.min(100, Math.round(precipSum * 20)) : 0,
        sunrise: sunrise,
        sunset: sunset,
        condition: cond.description,
        description: cond.description,
        icon: cond.icon
    };
}

// Build Consolidated Forecast Object
function buildCombinedForecast(omData) {
    const hourly = [];
    if (omData.hourly && omData.hourly.time) {
        for (let i = 0; i < Math.min(24, omData.hourly.time.length); i += 2) {
            const timeIso = omData.hourly.time[i];
            const cond = mapWmoCodeToCondition(omData.hourly.weather_code[i]);
            hourly.push({
                time: formatIsoTime(timeIso),
                tempC: omData.hourly.temperature_2m[i],
                icon: cond.icon
            });
        }
    }

    const daily = [];
    if (omData.daily && omData.daily.time) {
        for (let i = 0; i < Math.min(5, omData.daily.time.length); i++) {
            const dateStr = new Date(omData.daily.time[i]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const cond = mapWmoCodeToCondition(omData.daily.weather_code[i]);
            daily.push({
                day: i === 0 ? 'Today' : dateStr,
                tempMaxC: omData.daily.temperature_2m_max[i],
                tempMinC: omData.daily.temperature_2m_min[i],
                condition: cond.description,
                description: cond.description,
                icon: cond.icon
            });
        }
    }

    return { hourly, daily };
}

// OpenWeatherMap Current Parser
function parseOWMCurrent(json, titleOverride = null, subtitleOverride = null) {
    const countryName = json.sys && json.sys.country ? getCountryName(json.sys.country) : '';
    const mainCondition = json.weather[0].main;
    const desc = json.weather[0].description;

    return {
        name: titleOverride || json.name,
        subtitle: subtitleOverride || countryName,
        tempC: json.main.temp,
        feelsLikeC: json.main.feels_like,
        tempMinC: json.main.temp_min,
        tempMaxC: json.main.temp_max,
        humidity: json.main.humidity,
        windSpeed: Math.round(json.wind.speed * 3.6),
        windDirection: getWindDirectionText(json.wind.deg || 0),
        pressure: json.main.pressure,
        visibility: json.visibility ? (json.visibility / 1000).toFixed(1) : 10,
        uvIndex: 2,
        rainProbability: 0,
        sunrise: json.sys.sunrise ? formatTime(json.sys.sunrise * 1000) : '--:--',
        sunset: json.sys.sunset ? formatTime(json.sys.sunset * 1000) : '--:--',
        condition: mainCondition,
        description: desc,
        icon: getIconForCondition(mainCondition, desc)
    };
}

async function fetchOWMForecastFallback(lat, lon) {
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${APIKey}`);
        const json = await res.json();
        if (res.ok && json.list) {
            const hourly = json.list.slice(0, 10).map(item => ({
                time: formatTimeShort(item.dt * 1000),
                tempC: item.main.temp,
                icon: getIconForCondition(item.weather[0].main, item.weather[0].description)
            }));
            const dailyMap = {};
            json.list.forEach(item => {
                const dateStr = new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                if (!dailyMap[dateStr]) {
                    dailyMap[dateStr] = {
                        day: dateStr,
                        tempMaxC: item.main.temp_max,
                        tempMinC: item.main.temp_min,
                        condition: item.weather[0].main,
                        description: item.weather[0].description,
                        icon: getIconForCondition(item.weather[0].main, item.weather[0].description)
                    };
                }
            });
            currentForecastData = { hourly, daily: Object.values(dailyMap).slice(0, 5) };
        }
    } catch (e) {
        console.warn('OWM forecast fallback failed:', e);
    }
}

// Render All Weather UI
function renderAllWeather() {
    if (!currentWeatherData) return;
    const d = currentWeatherData;

    cityName.innerText = d.name;
    locationSubtitle.innerText = d.subtitle;
    weatherIcon.src = d.icon;
    temperatureVal.innerText = formatTempNum(d.tempC);
    description.innerText = d.description;

    feelsLikeVal.innerText = formatTemp(d.feelsLikeC);
    tempMaxVal.innerText = formatTemp(d.tempMaxC);
    tempMinVal.innerText = formatTemp(d.tempMinC);

    sunriseVal.innerText = d.sunrise;
    sunsetVal.innerText = d.sunset;

    // Highlights Grid
    humidityVal.innerText = `${d.humidity}%`;
    humidityDesc.innerText = d.humidity > 70 ? 'High Humidity' : (d.humidity < 30 ? 'Low Humidity' : 'Comfortable');

    windVal.innerText = `${d.windSpeed} Km/h`;
    windDesc.innerText = `${d.windDirection} • ${d.windSpeed > 25 ? 'Strong Breeze' : 'Light Breeze'}`;

    pressureVal.innerText = `${d.pressure} hPa`;
    visibilityVal.innerText = `${d.visibility} Km`;
    visibilityDesc.innerText = d.visibility >= 10 ? 'Clear Visibility' : 'Reduced Visibility';

    uvVal.innerText = d.uvIndex;
    uvDesc.innerText = d.uvIndex >= 8 ? 'Very High UV' : (d.uvIndex >= 6 ? 'High UV' : (d.uvIndex >= 3 ? 'Moderate UV' : 'Low UV Risk'));

    rainVal.innerText = `${d.rainProbability}%`;
    rainDesc.innerText = d.rainProbability > 50 ? 'High Chance of Rain' : (d.rainProbability > 20 ? 'Slight Chance' : 'Low Chance');

    renderHourly();
    renderDaily();
    showDashboard();
}

function renderHourly() {
    hourlyForecastContainer.innerHTML = '';
    if (!currentForecastData || !currentForecastData.hourly) return;

    currentForecastData.hourly.forEach(item => {
        const card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = `
            <span class="hourly-time">${item.time}</span>
            <img src="${item.icon}" class="hourly-icon" alt="Forecast Icon">
            <span class="hourly-temp">${formatTemp(item.tempC)}</span>
        `;
        hourlyForecastContainer.appendChild(card);
    });
}

function renderDaily() {
    dailyForecastContainer.innerHTML = '';
    if (!currentForecastData || !currentForecastData.daily) return;

    currentForecastData.daily.forEach(item => {
        const row = document.createElement('div');
        row.className = 'daily-row';
        row.innerHTML = `
            <span class="daily-day">${item.day}</span>
            <div class="daily-condition">
                <img src="${item.icon}" class="daily-icon" alt="Daily Icon">
                <span class="daily-desc">${item.description}</span>
            </div>
            <div class="daily-temps">
                <span class="max">${formatTemp(item.tempMaxC)}</span>
                <span class="min">${formatTemp(item.tempMinC)}</span>
            </div>
        `;
        dailyForecastContainer.appendChild(row);
    });
}

// Helper Utilities
function getWindDirectionText(deg) {
    if (deg === undefined || deg === null) return 'N';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
}

function getIconForCondition(main, desc = '') {
    const condition = main.toLowerCase();
    if (condition.includes('clear')) return 'assets/clear.png';
    if (condition.includes('cloud')) return 'assets/cloud.png';
    if (condition.includes('rain') || condition.includes('drizzle')) return 'assets/rain.jpg';
    if (condition.includes('snow')) return 'assets/snow.png';
    if (condition.includes('thunder')) return 'assets/rain.jpg';
    return 'assets/cloud.png';
}

function mapWmoCodeToCondition(code) {
    if (code === 0) return { description: 'Clear Sky', icon: 'assets/clear.png' };
    if (code >= 1 && code <= 3) return { description: 'Partly Cloudy', icon: 'assets/cloud.png' };
    if (code === 45 || code === 48) return { description: 'Foggy / Mist', icon: 'assets/cloud.png' };
    if (code >= 51 && code <= 67) return { description: 'Rain Showers', icon: 'assets/rain.jpg' };
    if (code >= 71 && code <= 77) return { description: 'Snowfall', icon: 'assets/snow.png' };
    if (code >= 80 && code <= 82) return { description: 'Heavy Rain', icon: 'assets/rain.jpg' };
    if (code >= 95) return { description: 'Thunderstorm', icon: 'assets/rain.jpg' };
    return { description: 'Overcast', icon: 'assets/cloud.png' };
}

function getCountryName(code) {
    try {
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        return regionNames.of(code) || code;
    } catch (e) {
        return code;
    }
}

function formatTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimeShort(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatIsoTime(isoStr) {
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showLoader() {
    loader.classList.add('show');
    errorDiv.classList.remove('show');
    dashboardContent.classList.add('hide');
}

function showDashboard() {
    loader.classList.remove('show');
    errorDiv.classList.remove('show');
    dashboardContent.classList.remove('hide');
}

function showError(msg) {
    loader.classList.remove('show');
    dashboardContent.classList.add('hide');
    errorMessage.innerText = msg;
    errorDiv.classList.add('show');
}
