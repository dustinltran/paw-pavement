import { useEffect, useState } from 'react';
import {
  type LocationResult,
  formatLocationName,
  searchLocations,
} from './services/geocoding';
import {
  type CurrentWeather,
  type WeatherLocation,
  fetchCurrentWeather,
} from './services/weather';
import {
  MAX_SAFE_SURFACE_TEMPERATURE,
  SURFACE_TEMPERATURE_SCALE,
  estimatePavementTemperature,
  getPawSafetyStatus,
} from './services/pavementTemperature';

type WeatherStatus = 'idle' | 'loading' | 'ready' | 'error';
type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';
type TemperatureUnit = 'F' | 'C';

const popularLocations = [
  'San Jose',
  'Cupertino',
  'Sunnyvale',
  'Santa Clara',
  'San Francisco',
  'Los Angeles',
  'New York',
  'Chicago',
  'Austin',
  'Seattle',
];

function fahrenheitToCelsius(temperature: number): number {
  return (temperature - 32) * (5 / 9);
}

function celsiusToFahrenheit(temperature: number): number {
  return temperature * (9 / 5) + 32;
}

function formatTemperature(temperatureFahrenheit: number, unit: TemperatureUnit): string {
  const value =
    unit === 'F' ? temperatureFahrenheit : fahrenheitToCelsius(temperatureFahrenheit);

  return `${Math.round(value)}°${unit}`;
}

function getRiskLabel(temperatureFahrenheit: number): string {
  const status = getPawSafetyStatus(temperatureFahrenheit);

  if (status === 'unsafe') {
    return 'absolute risk';
  }

  if (status === 'caution') {
    return 'risky';
  }

  return 'safe';
}

function App() {
  const [status, setStatus] = useState<WeatherStatus>('idle');
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [message, setMessage] = useState('Use your location to check walking weather.');
  const [query, setQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [searchMessage, setSearchMessage] = useState('Search for a city.');
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>('F');
  const [manualTemperature, setManualTemperature] = useState('');
  const pavement = weather
    ? estimatePavementTemperature({
        airTemperature: weather.temperature,
        cloudCover: weather.cloudCover,
        windSpeed: weather.windSpeed,
      })
    : null;
  const manualTemperatureValue = Number(manualTemperature);
  const manualTemperatureFahrenheit =
    temperatureUnit === 'F'
      ? manualTemperatureValue
      : celsiusToFahrenheit(manualTemperatureValue);
  const manualEstimate =
    manualTemperature.trim() && Number.isFinite(manualTemperatureValue)
      ? estimatePavementTemperature({
          airTemperature: manualTemperatureFahrenheit,
          cloudCover: 0,
          windSpeed: 0,
        })
      : null;

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 3) {
      setSearchStatus('idle');
      setSearchResults([]);
      setSearchMessage('Search with at least 3 characters.');
      return;
    }

    if (trimmedQuery === locationLabel) {
      setSearchStatus('idle');
      setSearchResults([]);
      setSearchMessage('Selected location.');
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchStatus('loading');
      setSearchMessage('Searching locations...');

      try {
        const results = await searchLocations(trimmedQuery, controller.signal);
        setSearchResults(results);
        setSearchStatus('ready');
        setSearchMessage(results.length ? 'Select a location.' : 'No locations found.');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setSearchStatus('error');
        setSearchResults([]);
        setSearchMessage('Unable to search locations.');
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [locationLabel, query]);

  const loadWeather = async (
    currentLocation: WeatherLocation,
    successMessage: string,
    label = '',
  ) => {
    setLocation(currentLocation);
    setLocationLabel(label);
    setStatus('loading');
    setWeather(null);
    setMessage('Fetching current weather...');

    try {
      const currentWeather = await fetchCurrentWeather(currentLocation);
      setWeather(currentWeather);
      setStatus('ready');
      setMessage(successMessage);
    } catch (error) {
      setWeather(null);
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : 'Unable to fetch current weather.',
      );
    }
  };

  const handleWeatherRequest = () => {
    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('Geolocation is not available in this browser.');
      return;
    }

    setStatus('loading');
    setMessage('Waiting for location permission...');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const currentLocation: WeatherLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        await loadWeather(currentLocation, 'Current weather for your location.');
      },
      () => {
        setStatus('error');
        setMessage('Location permission was denied or unavailable.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleLocationSelect = async (result: LocationResult) => {
    const label = formatLocationName(result);

    setLocationLabel(label);
    setQuery(label);
    setSearchResults([]);
    setSearchMessage('Selected location.');

    await loadWeather(
      {
        latitude: result.latitude,
        longitude: result.longitude,
        timezone: result.timezone,
      },
      `Current weather for ${label}.`,
      label,
    );
  };

  const handlePopularLocation = async (name: string) => {
    setQuery(name);
    setSearchResults([]);
    setSearchStatus('loading');
    setSearchMessage(`Searching ${name}...`);

    try {
      const [result] = await searchLocations(name);

      if (!result) {
        setSearchStatus('error');
        setSearchMessage(`No result found for ${name}.`);
        return;
      }

      setSearchStatus('ready');
      await handleLocationSelect(result);
    } catch {
      setSearchStatus('error');
      setSearchMessage(`Unable to search ${name}.`);
    }
  };

  return (
    <main className="app-shell">
      <div className="unit-toggle" aria-label="Temperature unit">
        <span>Temperature</span>
        <div>
          <button
            className={temperatureUnit === 'F' ? 'active' : ''}
            type="button"
            onClick={() => setTemperatureUnit('F')}
          >
            °F
          </button>
          <button
            className={temperatureUnit === 'C' ? 'active' : ''}
            type="button"
            onClick={() => setTemperatureUnit('C')}
          >
            °C
          </button>
        </div>
      </div>

      <section className="intro" aria-labelledby="page-title">
        <div className="brand-mark" aria-hidden="true">
          <span className="pad" />
          <span className="toe toe-one" />
          <span className="toe toe-two" />
          <span className="toe toe-three" />
          <span className="toe toe-four" />
        </div>

        <div className="intro-copy">
          <p className="eyebrow">Paw Pavement</p>
          <h3 id="page-title">Plan a cooler walk with your best friend.</h3>

        </div>

        <aside className="quick-view" aria-label="Pavement quick view">
          <div>
            <p className="quick-label">Maximum Safe Surface</p>
            <strong>
              {formatTemperature(MAX_SAFE_SURFACE_TEMPERATURE, temperatureUnit)}
            </strong>
          </div>

          <div className="risk-scale">
            {SURFACE_TEMPERATURE_SCALE.map((temperature) => (
              <span
                className={getRiskLabel(temperature).replace(' ', '-')}
                key={temperature}
                title={getRiskLabel(temperature)}
              >
                {formatTemperature(temperature, temperatureUnit)}
              </span>
            ))}
          </div>

          <label className="manual-estimator" htmlFor="manual-temperature">
            <span>Air Temperature</span>
            <input
              id="manual-temperature"
              type="number"
              inputMode="decimal"
              value={manualTemperature}
              onChange={(event) => setManualTemperature(event.target.value)}
              placeholder={`Enter °${temperatureUnit}`}
            />
          </label>

          <div className="quick-results">
            <span>
              Asphalt{' '}
              <strong>
                {manualEstimate
                  ? formatTemperature(
                      manualEstimate.asphaltTemperature,
                      temperatureUnit,
                    )
                  : '--'}
              </strong>
            </span>
            <span>
              Concrete{' '}
              <strong>
                {manualEstimate
                  ? formatTemperature(
                      manualEstimate.concreteTemperature,
                      temperatureUnit,
                    )
                  : '--'}
              </strong>
            </span>
          </div>
        </aside>
      </section>

      <section className="weather-panel" aria-label="Current walking weather">
        <div className="weather-header">
          <div>
            <h2>Current Weather</h2>
            <p>{message}</p>
          </div>
          <button
            className="weather-button"
            type="button"
            onClick={handleWeatherRequest}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Checking...' : 'Use My Location'}
          </button>
        </div>

        <div className="location-search">
          <label htmlFor="location-search">Search Location</label>
          <input
            id="location-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="City name"
            autoComplete="off"
          />
          <p>{searchMessage}</p>

          {searchResults.length > 0 && (
            <ul className="search-results" aria-label="Location search results">
              {searchResults.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => handleLocationSelect(result)}>
                    {formatLocationName(result)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {location && (
          <p className="coordinates">
            {locationLabel && <span>{locationLabel} · </span>}
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </p>
        )}

        <div className="weather-grid">
          <article>
            <span>Temperature</span>
            <strong>
              {weather ? formatTemperature(weather.temperature, temperatureUnit) : '--'}
            </strong>
          </article>
          <article>
            <span>Wind</span>
            <strong>{weather ? `${Math.round(weather.windSpeed)} mph` : '--'}</strong>
          </article>
          <article>
            <span>Cloud Cover</span>
            <strong>{weather ? `${weather.cloudCover}%` : '--'}</strong>
          </article>
          <article>
            <span>Humidity</span>
            <strong>{weather ? `${weather.humidity}%` : '--'}</strong>
          </article>
        </div>

        <div className="pavement-panel">
          <div>
            <h3>Paw Safety</h3>
            <p>
              {pavement
                ? `Status: ${pavement.safetyStatus}`
                : 'Check weather to estimate pavement temperature.'}
            </p>
          </div>

          <div className="surface-grid">
            <article>
              <span>Asphalt</span>
              <strong>
                {pavement
                  ? formatTemperature(pavement.asphaltTemperature, temperatureUnit)
                  : '--'}
              </strong>
            </article>
            <article>
              <span>Concrete</span>
              <strong>
                {pavement
                  ? formatTemperature(pavement.concreteTemperature, temperatureUnit)
                  : '--'}
              </strong>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
