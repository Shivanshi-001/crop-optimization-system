// ── Validation rules ─────────────────────────────────────────────────────────
const validationRules = {
    N:    { min: 0,   max: 140, name: 'Nitrogen',    unit: 'kg/ha' },
    P:    { min: 5,   max: 145, name: 'Phosphorus',  unit: 'kg/ha' },
    K:    { min: 5,   max: 205, name: 'Potassium',   unit: 'kg/ha' },
    temp: { min: 10,  max: 45,  name: 'Temperature', unit: '°C'    },
    hum:  { min: 15,  max: 100, name: 'Humidity',    unit: '%'     },
    ph:   { min: 3.5, max: 9.9, name: 'Soil pH',     unit: ''      },
    rain: { min: 20,  max: 300, name: 'Rainfall',    unit: 'mm'    }
};

// ── Average NPK profiles per soil type (data-fallback for accessibility) ─────
// Source: standard agronomic reference ranges for Indian soil types
const soilNpkProfiles = {
    sandy:    { N: 40,  P: 20,  K: 30  },
    loamy:    { N: 60,  P: 50,  K: 60  },
    clayey:   { N: 55,  P: 45,  K: 80  },
    black:    { N: 70,  P: 60,  K: 100 },
    alluvial: { N: 65,  P: 55,  K: 70  },
    red:      { N: 35,  P: 25,  K: 40  }
};

const soilDisplayNames = {
    sandy: 'Sandy', loamy: 'Loamy', clayey: 'Clayey',
    black: 'Black', alluvial: 'Alluvial', red: 'Red'
};

// ── Attach real-time validation listeners ─────────────────────────────────────
Object.keys(validationRules).forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.addEventListener('input', () => validateField(fieldId));
    input.addEventListener('blur',  () => validateField(fieldId));
});

// ── Validate single field ─────────────────────────────────────────────────────
function validateField(fieldId) {
    const input    = document.getElementById(fieldId);
    const errorMsg = document.getElementById(`error-${fieldId}`);
    const group    = document.getElementById(`group-${fieldId}`);
    const rule     = validationRules[fieldId];
    const value    = parseFloat(input.value);

    if (input.value === '') {
        input.classList.remove('invalid');
        errorMsg.classList.remove('show');
        group.classList.remove('error');
        return true;
    }

    const unitStr = rule.unit ? ` ${rule.unit}` : '';

    if (isNaN(value) || value < rule.min || value > rule.max) {
        input.classList.add('invalid');
        errorMsg.textContent = `${rule.name} must be between ${rule.min}${unitStr} and ${rule.max}${unitStr}`;
        errorMsg.classList.add('show');
        group.classList.add('error');
        return false;
    }

    input.classList.remove('invalid');
    errorMsg.classList.remove('show');
    group.classList.remove('error');
    return true;
}

// ── Validate all fields ───────────────────────────────────────────────────────
function validateAllFields() {
    let allValid = true;

    // Skip NPK validation if estimated values are being used
    const npkToggle   = document.getElementById('npk-toggle');
    const npkEstimated = npkToggle && npkToggle.checked;
    const npkFields   = ['N', 'P', 'K'];

    Object.keys(validationRules).forEach(fieldId => {
        if (npkEstimated && npkFields.includes(fieldId)) return; // skip — auto-filled

        const input    = document.getElementById(fieldId);
        const errorMsg = document.getElementById(`error-${fieldId}`);
        const group    = document.getElementById(`group-${fieldId}`);

        if (input.value === '') {
            errorMsg.textContent = `${validationRules[fieldId].name} is required`;
            errorMsg.classList.add('show');
            group.classList.add('error');
            input.classList.add('invalid');
            allValid = false;
        } else if (!validateField(fieldId)) {
            allValid = false;
        }
    });

    return allValid;
}

// ── NPK Accessibility toggle ──────────────────────────────────────────────────
function handleNpkToggle() {
    const toggle    = document.getElementById('npk-toggle');
    const label     = document.getElementById('npk-toggle-label');
    const hint      = document.getElementById('npk-hint');
    const soilName  = document.getElementById('npk-soil-name');
    const soilVal   = document.getElementById('soil').value;
    const isOn      = toggle.checked;

    label.textContent = isOn
        ? 'Using estimated NPK values (lab test unavailable)'
        : 'I have lab-tested NPK values';

    if (isOn) {
        // Fill NPK with soil-type averages and lock fields
        const profile = soilNpkProfiles[soilVal] || soilNpkProfiles.loamy;
        ['N', 'P', 'K'].forEach(f => {
            const input = document.getElementById(f);
            input.value    = profile[f];
            input.readOnly = true;
            input.classList.add('auto-filled');
            // Clear any prior validation errors
            document.getElementById(`error-${f}`).classList.remove('show');
            document.getElementById(`group-${f}`).classList.remove('error');
            input.classList.remove('invalid');
        });
        soilName.textContent = soilDisplayNames[soilVal] || soilVal;
        hint.style.display   = 'block';
    } else {
        // Unlock NPK fields and clear auto-filled values
        ['N', 'P', 'K'].forEach(f => {
            const input    = document.getElementById(f);
            input.value    = '';
            input.readOnly = false;
            input.classList.remove('auto-filled');
        });
        hint.style.display = 'none';
    }
}

// ── GPS / Live Weather auto-fill ──────────────────────────────────────────────
async function getLocation() {
    const btn      = document.getElementById('gps-btn');
    const keyInput = document.getElementById('weather-api-key');
    const apiKey   = keyInput ? keyInput.value.trim() : '';
    const statusEl = document.getElementById('api-key-status');

    // Debug: visible in F12 → Console
    console.log('[GPS] Key input element found:', !!keyInput);
    console.log('[GPS] API key value:', apiKey ? `"${apiKey.slice(0,6)}…" (${apiKey.length} chars)` : 'EMPTY');

    if (!navigator.geolocation) {
        setGpsState(btn, 'unsupported');
        return;
    }

    setGpsState(btn, 'loading');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            console.log('[GPS] Coordinates:', lat, lon);

            // ── Live mode: WeatherAPI.com key provided ────────────────────────
            if (apiKey !== '') {
                if (statusEl) { statusEl.textContent = 'Contacting WeatherAPI…'; statusEl.style.color = '#3b82f6'; }
                try {
                    // Single call to WeatherAPI forecast endpoint (7 days, free tier)
                    // Gives us current conditions + daily forecast with precip_mm per day
                    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lon}&days=7&aqi=no&alerts=no`;

                    const resp = await fetch(url);
                    console.log('[GPS] WeatherAPI status:', resp.status);

                    if (resp.status === 401 || resp.status === 403) {
                        const err = await resp.json();
                        const msg = err?.error?.message || `Error ${resp.status}`;
                        if (statusEl) { statusEl.textContent = `✗ ${msg}`; statusEl.style.color = '#ef4444'; }
                        throw new Error(msg);
                    }
                    if (!resp.ok) throw new Error(`API error ${resp.status}`);

                    const data = await resp.json();

                    // WeatherAPI structure is different from OpenWeatherMap:
                    //   temp      → data.current.temp_c
                    //   humidity  → data.current.humidity
                    //   rainfall  → sum of daily totalprecip_mm across 7 forecast days
                    //               then scale to annual estimate × (365/7) ≈ × 52
                    const temp = data.current.temp_c.toFixed(1);
                    const hum  = Math.round(data.current.humidity);

                    const rain7Day = data.forecast.forecastday.reduce((sum, day) => {
                        return sum + (day.day.totalprecip_mm || 0);
                    }, 0);
                    const rainEstimate = Math.min(300, Math.max(20, Math.round(rain7Day * 52)));

                    document.getElementById('temp').value = temp;
                    document.getElementById('hum').value  = hum;
                    document.getElementById('rain').value = rainEstimate;
                    validateField('temp');
                    validateField('hum');
                    validateField('rain');

                    const locationName = data.location.name || 'your location';
                    if (statusEl) { statusEl.textContent = `✓ Live — ${locationName}`; statusEl.style.color = '#10b981'; }
                    setGpsState(btn, 'success', locationName);
                    return;

                } catch (err) {
                    console.error('[GPS] WeatherAPI failed:', err.message);
                    if (statusEl && !statusEl.textContent.startsWith('✗')) {
                        statusEl.textContent = `✗ ${err.message} — using seasonal estimate`;
                        statusEl.style.color = '#f59e0b';
                    }
                    // Fall through to seasonal fallback
                }
            } else {
                console.log('[GPS] No API key — using seasonal estimates');
                if (statusEl) { statusEl.textContent = 'No key — using seasonal estimates'; statusEl.style.color = '#f59e0b'; }
            }

            // ── Seasonal fallback ─────────────────────────────────────────────
            const month     = new Date().getMonth();
            const isMonsoon = month >= 5 && month <= 8;
            const isWinter  = month === 11 || month <= 1;

            const demoTemp = isWinter  ? (15 + Math.random() * 5).toFixed(1)
                           : isMonsoon ? (28 + Math.random() * 5).toFixed(1)
                           :             (32 + Math.random() * 6).toFixed(1);
            const demoHum  = isWinter  ? Math.round(40 + Math.random() * 15)
                           : isMonsoon ? Math.round(75 + Math.random() * 15)
                           :             Math.round(50 + Math.random() * 20);
            const demoRain = isMonsoon ? Math.round(180 + Math.random() * 80)
                           : isWinter  ? Math.round(20  + Math.random() * 30)
                           :             Math.round(60  + Math.random() * 60);

            document.getElementById('temp').value  = demoTemp;
            document.getElementById('hum').value   = demoHum;
            document.getElementById('rain').value  = demoRain;
            validateField('temp');
            validateField('hum');
            validateField('rain');

            setGpsState(btn, 'demo');
        },
        (err) => {
            console.error('[GPS] Geolocation denied:', err.message);
            setGpsState(btn, 'denied');
        },
        { timeout: 10000 }
    );
}

// Helper: manages GPS button visual states
function setGpsState(btn, state, locationName = '') {
    const states = {
        loading:     { text: 'Fetching location…',                   disabled: true  },
        success:     { text: `Temp, Humidity & Rainfall filled — ${locationName}`, disabled: false },
        demo:        { text: 'Seasonal estimates filled (no API key)', disabled: false },
        error:       { text: 'Retry GPS',                            disabled: false },
        denied:      { text: 'Location access denied',               disabled: false },
        unsupported: { text: 'GPS not supported',                    disabled: true  }
    };
    const s = states[state] || states.error;
    btn.textContent   = s.text;
    btn.disabled      = s.disabled;
    btn.dataset.state = state;
}

// ── Main prediction call ──────────────────────────────────────────────────────
async function getPrediction() {
    if (!validateAllFields()) {
        alert('Please correct the highlighted errors before proceeding.');
        return;
    }

    const inputs = {
        N:            document.getElementById('N').value,
        P:            document.getElementById('P').value,
        K:            document.getElementById('K').value,
        temperature:  document.getElementById('temp').value,
        humidity:     document.getElementById('hum').value,
        ph:           document.getElementById('ph').value,
        rainfall:     document.getElementById('rain').value,
        soil_type:    document.getElementById('soil').value,
        model_choice: document.getElementById('model_choice').value   // ← model selector
    };

    const npkToggle = document.getElementById('npk-toggle');
    const npkEstimated = npkToggle && npkToggle.checked;

    // Friendly display labels for Input Summary
    const labelMap = {
        N: 'Nitrogen (N)', P: 'Phosphorus (P)', K: 'Potassium (K)',
        temperature: 'Temperature', humidity: 'Humidity',
        ph: 'Soil pH', rainfall: 'Rainfall',
        soil_type: 'Soil Type', model_choice: 'Model'
    };

    const unitMap = {
        N: 'kg/ha', P: 'kg/ha', K: 'kg/ha',
        temperature: '°C', humidity: '%',
        ph: '', rainfall: 'mm',
        soil_type: '', model_choice: ''
    };

    try {
        const response = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputs)
        });

        const result = await response.json();

        const summaryArea = document.getElementById('summary-area');
        summaryArea.style.display = 'grid';

        // ── Input Summary panel ───────────────────────────────────────────────
        document.getElementById('input-review').innerHTML =
            Object.entries(inputs).map(([key, val]) => {
                const unit      = unitMap[key] ? ` ${unitMap[key]}` : '';
                const estimated = npkEstimated && ['N','P','K'].includes(key)
                    ? ' <span class="estimated-badge">est.</span>' : '';
                return `<div class="data-tag">
                            <strong>${labelMap[key]}:</strong> ${val}${unit}${estimated}
                        </div>`;
            }).join('');

        // ── Result panel ──────────────────────────────────────────────────────
        const resDiv = document.getElementById('final-result');

        if (result.status === 'success') {
            const m       = result.data.metrics || {};
            const matches = result.data.crop_matches || [];

            // ── Crop match cards with percentage bars ─────────────────────────
            const rankLabels  = ['#1 Best Match', '#2', '#3', '#4', '#5'];
            const rankClasses = ['match-rank-1', 'match-rank-2', 'match-rank-3', 'match-rank-4', 'match-rank-5'];

            const cropCardsHTML = matches.map((c, i) => `
                <div class="crop-match-card ${rankClasses[i] || ''}">
                    <div class="crop-match-header">
                        <span class="crop-rank-badge">${rankLabels[i] || `#${c.rank}`}</span>
                        <span class="crop-match-name">${c.crop.charAt(0).toUpperCase() + c.crop.slice(1)}</span>
                        <span class="crop-match-pct">${c.match_pct}%</span>
                    </div>
                    <div class="crop-match-bar-bg">
                        <div class="crop-match-bar" style="width: ${c.match_pct}%; --bar-rank: ${i}"></div>
                    </div>
                </div>
            `).join('');

            // ── Agronomic metrics grid ────────────────────────────────────────
            const metricsHTML = m.suitability_score ? `
                <div class="metrics-grid">
                    <div class="metric-tag">
                        <span class="metric-icon icon-target">S</span>
                        <span><strong>Suitability:</strong> ${m.suitability_score}%</span>
                    </div>
                    <div class="metric-tag">
                        <span class="metric-icon icon-soil">N</span>
                        <span><strong>Soil Health:</strong> ${m.nutrient_index}</span>
                    </div>
                    <div class="metric-tag">
                        <span class="metric-icon icon-water">W</span>
                        <span><strong>Water Stress:</strong> ${m.water_stress}</span>
                    </div>
                    <div class="metric-tag">
                        <span class="metric-icon icon-ph">pH</span>
                        <span><strong>pH Status:</strong> ${m.ph_suitability}</span>
                    </div>
                </div>` : '';

            resDiv.innerHTML = `
                <p class="result-logic"><strong>Model:</strong> ${inputs.model_choice} &nbsp;·&nbsp; ${result.data.logic}</p>
                <div class="crop-matches-list">${cropCardsHTML}</div>
                ${metricsHTML}
            `;
        } else {
            resDiv.innerHTML = `<div class="error-message">Error: ${result.message}</div>`;
        }

    } catch (error) {
        document.getElementById('summary-area').style.display = 'grid';
        document.getElementById('final-result').innerHTML =
            `<div class="error-message">Server Connection Error: ${error.message}</div>`;
    }
}