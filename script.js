const WEATHER_API_KEY = '4a470009d13b4b7a9a9105645260210';
const DEFAULT_CITY = 'Visakhapatnam';

// Application State
let currentUnit = 'C';
let currentWeatherData = null;
let currentForecastData = null;
let currentForecastRaw = null;
let tempChartInstance = null;
let lastLocationRef = { query: DEFAULT_CITY, lat: null, lon: null, title: null, subtitle: null };
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
// Splash Animation: 
let splashTimeDone = false;
let firstLoadDone = false;
function hideSplash() {
    if (!(splashTimeDone && firstLoadDone)) return;
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 900);
}
function markFirstLoad() {
    firstLoadDone = true;
    hideSplash();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { splashTimeDone = true; hideSplash(); }, 2400);
   
    setTimeout(() => { splashTimeDone = true; firstLoadDone = true; hideSplash(); }, 8000);
    startLiveClock();
    setDateBadge();
    setupAutoSync();

    // పాత saved location ఉంటే clear చేస్తాం. ఎప్పుడూ default city తో మొదలవుతుంది.
    localStorage.removeItem('lastSearchedLocation');
    searchWeather(DEFAULT_CITY);    // Auto-detect user location on startup
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                try {
                    const revRes = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
                    );
                    const revData = await revRes.json();
                    const addr = revData.address || {};
                    const name = addr.village || addr.town || addr.hamlet || addr.suburb || addr.city || 'Your Location';
                    const subtitle = [addr.county || addr.state_district || addr.state, addr.country].filter(Boolean).join(', ');
                    fetchRealtimeWeather(lat, lon, name, subtitle);
                } catch (e) {
                    fetchRealtimeWeather(lat, lon, 'Your Location', 'GPS Coordinates');
                }
            },
                      () => {
                // GPS denied — empty state 
                showEmptyState();
                function showEmptyState() {
    markFirstLoad();
    loader.classList.remove('show');
    errorDiv.classList.remove('show');
    dashboardContent.classList.add('hide');
    
    const emptyDiv = document.getElementById('emptyState');
    if (emptyDiv) emptyDiv.style.display = 'flex';
}
            },
            { timeout: 6000 }
        );
    } else {
        searchWeather(DEFAULT_CITY);
    }
});

// Live Clock
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

// Auto-Sync every 5 minutes
function setupAutoSync() {
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    autoSyncInterval = setInterval(refreshCurrentWeather, 5 * 60 * 1000);
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

// Unit Toggle
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

    if (currentWeatherData) renderAllWeather();
}

function formatTemp(celsiusVal) {
    if (celsiusVal === undefined || celsiusVal === null) return '--';
    if (currentUnit === 'F') return Math.round((celsiusVal * 9) / 5 + 32) + '°F';
    return Math.round(celsiusVal) + '°C';
}

function formatTempNum(celsiusVal) {
    if (celsiusVal === undefined || celsiusVal === null) return '--';
    if (currentUnit === 'F') return Math.round((celsiusVal * 9) / 5 + 32);
    return Math.round(celsiusVal);
}

// Search Events
searchBtn.addEventListener('click', handleSearchSubmit);

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        suggestionsBox.classList.remove('show');
        handleSearchSubmit();
    }
});

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 2) {
        suggestionsBox.classList.remove('show');
        suggestionsBox.innerHTML = '';
        return;
    }

    debounceTimer = setTimeout(() => fetchSuggestions(query), 250);
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

// GPS Location
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

            try {
                const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`);
                const revData = await revRes.json();
                const addr = revData.address || {};
                const name = addr.village || addr.town || addr.hamlet || addr.suburb || addr.city || 'Your Location';
                const subtitle = [addr.county || addr.state_district || addr.state, addr.country].filter(Boolean).join(', ');

                fetchRealtimeWeather(lat, lon, name, subtitle);
            } catch (e) {
                fetchRealtimeWeather(lat, lon, 'Your Location', 'GPS Coordinates');
            }
        },
        () => {
            showError('Unable to retrieve your location. Please grant GPS permission or type a city/village name.');
        }
    );
});

function handleSearchSubmit() {
    const query = searchInput.value.trim();
    if (query === '') return;
    searchWeather(query);
}

// Suggestions
async function fetchSuggestions(query) {
    try {
        let results = [];

        const omRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        const omData = await omRes.json();

        if (omData.results && omData.results.length > 0) {
            omData.results.forEach(item => {
                results.push({
                    name: item.name,
                    subtitle: [item.admin1, item.country].filter(Boolean).join(', '),
                    lat: item.latitude,
                    lon: item.longitude
                });
            });
        }

        if (results.length < 3) {
            try {
                const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`);
                const nomData = await nomRes.json();

                if (nomData && nomData.length > 0) {
                    nomData.forEach(item => {
                        const addr = item.address || {};
                        const placeName = addr.village || addr.town || addr.hamlet || addr.suburb || addr.city || item.name;
                        const sub = [addr.county || addr.state_district || addr.state, addr.country].filter(Boolean).join(', ');

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
                console.warn('Nominatim suggestion error:', e);
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

// Location Search (last location save చేయము)
async function searchWeather(query) {
    showLoader();
    lastLocationRef = { query, lat: null, lon: null, title: null, subtitle: null };

    try {
        // Step 1: Open-Meteo Geocoding
        const omGeoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
        const omGeoData = await omGeoRes.json();

        if (omGeoData.results && omGeoData.results.length > 0) {
            const place = omGeoData.results[0];
            const stateCountry = [place.admin1, place.country].filter(Boolean).join(', ');
            await fetchRealtimeWeather(place.latitude, place.longitude, place.name, stateCountry);
            return;
        }

        // Step 2: OpenStreetMap Nominatim (చిన్న villages కోసం)
        const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`);
        const nomData = await nomRes.json();

        if (nomData && nomData.length > 0) {
            const item = nomData[0];
            const addr = item.address || {};
            const placeName = addr.village || addr.town || addr.hamlet || addr.suburb || addr.city || item.name;
            const stateCountry = [addr.county || addr.state_district || addr.state, addr.country].filter(Boolean).join(', ');

            await fetchRealtimeWeather(parseFloat(item.lat), parseFloat(item.lon), placeName, stateCountry);
            return;
        }

        showError(`Could not locate weather data for "${query}". Please verify the location spelling.`);
    } catch (err) {
        console.error('Search location error:', err);
        showError('Network error while searching location. Please check your internet connection.');
    }
}

// Weather Fetcher (WeatherAPI)
async function fetchRealtimeWeather(lat, lon, title, subtitle) {
    showLoader();
    lastLocationRef = { query: null, lat, lon, title, subtitle };

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`),
            fetch(`https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&days=5&aqi=no&alerts=yes`)
        ]);

        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();

        if (!currentRes.ok || !forecastRes.ok) {
            console.error('API error:', currentData, forecastData);
            showError('Unable to fetch weather data.');
            return;
        }

        const c = currentData.current;
        const loc = currentData.location;
        const today = forecastData.forecast.forecastday[0];

        currentWeatherData = {
            name: title || loc.name,
            subtitle: subtitle || `${loc.region}, ${loc.country}`,
            tempC: c.temp_c,
            feelsLikeC: c.feelslike_c,
            tempMinC: today.day.mintemp_c,
            tempMaxC: today.day.maxtemp_c,
            humidity: c.humidity,
            windSpeed: Math.round(c.wind_kph),
            windDirection: c.wind_dir,
            pressure: c.pressure_mb,
            visibility: c.vis_km,
            uvIndex: Math.round(c.uv),
            rainProbability: today.day.daily_chance_of_rain,
            sunrise: today.astro.sunrise,
            sunset: today.astro.sunset,
            condition: c.condition.text,
            description: c.condition.text,
            icon: 'https:' + c.condition.icon
        };

        // Hourly (ప్రతి 2 గంటలకు ఒకటి)
        const hourly = today.hour
            .filter((_, i) => i % 2 === 0)
            .map(h => ({
                time: h.time.split(' ')[1],
                tempC: h.temp_c,
                icon: 'https:' + h.condition.icon
            }));

        // Daily
        const daily = forecastData.forecast.forecastday.map((day, i) => ({
            day: i === 0 ? 'Today' : new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            tempMaxC: day.day.maxtemp_c,
            tempMinC: day.day.mintemp_c,
            condition: day.day.condition.text,
            description: day.day.condition.text,
            icon: 'https:' + day.day.condition.icon
        }));

        currentForecastData = { hourly, daily };
        currentForecastRaw = forecastData;

        // Alerts
        const alertBox = document.getElementById('weatherAlert');
        const alertList = forecastData.alerts && forecastData.alerts.alert;
        if (alertList && alertList.length > 0) {
            document.getElementById('alertTitle').innerText = alertList[0].headline || 'Weather Alert';
            document.getElementById('alertDesc').innerText = alertList[0].desc || alertList[0].event || '';
            alertBox.style.display = 'flex';
        } else {
            alertBox.style.display = 'none';
        }

        renderAllWeather();
    } catch (err) {
        console.error('WeatherAPI fetch error:', err);
        showError('Error loading weather data.');
    }
}

// Render UI
function renderAllWeather() {
    if (!currentWeatherData) return;
    const d = currentWeatherData;

    cityName.innerText = d.name;

    // Dynamic background
    const cond = d.condition.toLowerCase();
    document.body.classList.remove('weather-clear', 'weather-cloudy', 'weather-rain', 'weather-sunny', 'weather-haze', 'weather-thunder');
    if (cond.includes('thunder') || cond.includes('storm')) {
        document.body.classList.add('weather-thunder');
    } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
        document.body.classList.add('weather-rain');
    } else if (cond.includes('sunny') || cond.includes('clear')) {
        document.body.classList.add('weather-sunny');
    } else if (cond.includes('haze') || cond.includes('fog') || cond.includes('mist') || cond.includes('smoke')) {
        document.body.classList.add('weather-haze');
    } else if (cond.includes('cloud') || cond.includes('overcast')) {
        document.body.classList.add('weather-cloudy');
    } else {
        document.body.classList.add('weather-clear');
    }

    locationSubtitle.innerText = d.subtitle;
    weatherIcon.src = d.icon;
    temperatureVal.innerText = formatTempNum(d.tempC);
    description.innerText = d.description;

    feelsLikeVal.innerText = formatTemp(d.feelsLikeC);
    tempMaxVal.innerText = formatTemp(d.tempMaxC);
    tempMinVal.innerText = formatTemp(d.tempMinC);

    sunriseVal.innerText = d.sunrise;
    sunsetVal.innerText = d.sunset;

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
    showDashboard();   // ముందు dashboard చూపించాలి
    renderTempGraph(); // ఆ తర్వాతే graph గీయాలి (లేకపోతే size 0 అవుతుంది)
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

// Temperature Graph
function renderTempGraph() {
    if (!currentForecastRaw) return;

    const canvas = document.getElementById('tempChart');
    if (!canvas || typeof Chart === 'undefined') {
        console.error('Chart.js load అవ్వలేదు');
        return;
    }

    const hours = currentForecastRaw.forecast.forecastday[0].hour;
    const labels = hours.map(h => h.time.split(' ')[1]);
    const temps = hours.map(h => formatTempNum(h.temp_c));

    if (tempChartInstance) tempChartInstance.destroy();

    tempChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Temperature (°${currentUnit})`,
                data: temps,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: '#38bdf8',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', maxTicksLimit: 8, font: { size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#94a3b8', font: { size: 11 }, callback: (v) => v + '°' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            }
        }
    });
}

// UI State Helpers
function showLoader() {
    loader.classList.add('show');
    errorDiv.classList.remove('show');
    dashboardContent.classList.add('hide');
}

function showDashboard() {
    markFirstLoad();
    loader.classList.remove('show');
    errorDiv.classList.remove('show');
    dashboardContent.classList.remove('hide');
}

function showError(msg) {
    markFirstLoad();
    loader.classList.remove('show');
    dashboardContent.classList.add('hide');
    errorMessage.innerText = msg;
    errorDiv.classList.add('show');
}