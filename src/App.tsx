import { useEffect, useState, type PointerEvent } from 'react';
import {
  type LocationResult,
  formatLocationName,
  searchLocations,
} from './services/geocoding';
import {
  type CurrentWeather,
  type HourlyWeather,
  type WeatherLocation,
  fetchCurrentWeather,
} from './services/weather';
import {
  MAX_SAFE_SURFACE_TEMPERATURE,
  estimatePavementTemperature,
} from './services/pavementTemperature';

type WeatherStatus = 'idle' | 'loading' | 'ready' | 'error';
type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';
type TemperatureUnit = 'F' | 'C';


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

const burnRiskRows = [
  { temperature: '100°F (37.8°C)', painRisk: 'Safe', riskLevel: 'safe' },
  { temperature: '105°F (40.5°C)', painRisk: '10-30+ minutes', riskLevel: 'caution' },
  { temperature: '110°F (43°C)', painRisk: '5-15 minutes', riskLevel: 'caution' },
  { temperature: '120°F (49°C)', painRisk: '1-2 minutes', riskLevel: 'caution' },
  { temperature: '130°F (54°C)', painRisk: '10-30 seconds', riskLevel: 'danger' },
  { temperature: '140°F (60°C)', painRisk: '2-5 seconds', riskLevel: 'danger' },
  { temperature: '145°F (63°C)', painRisk: '1-3 seconds', riskLevel: 'danger' },
  { temperature: '150°F+ (65°C+)', painRisk: 'Nearly immediate', riskLevel: 'danger' },
];

type HourlyChartPoint = HourlyWeather & {
  asphaltTemperature: number;
  concreteTemperature: number;
};

function formatHourLabel(time: string): string {
  return new Intl.DateTimeFormat([], {
    hour: 'numeric',
    hour12: true,
  }).format(new Date(time));
}

function HourlyWeatherChart({
  hourly,
  temperatureUnit,
}: {
  hourly: HourlyWeather[];
  temperatureUnit: TemperatureUnit;
}) {
  const [hoveredIndex, setHoveredIndex] = useState(0);
  const chartPoints: HourlyChartPoint[] = hourly.slice(0, 24).map((hour) => {
    const surface = estimatePavementTemperature({
      airTemperature: hour.temperature,
      cloudCover: hour.cloudCover,
      windSpeed: hour.windSpeed,
    });

    return {
      ...hour,
      asphaltTemperature: surface.asphaltTemperature,
      concreteTemperature: surface.concreteTemperature,
    };
  });

  if (chartPoints.length < 2) {
    return null;
  }

  const activePoint = chartPoints[hoveredIndex] ?? chartPoints[0];
  const temperatures = chartPoints.map((point) => point.temperature);
  const minTemperature = Math.floor(Math.min(...temperatures) / 5) * 5;
  const maxTemperature = Math.ceil(Math.max(...temperatures) / 5) * 5;
  const temperatureRange = Math.max(maxTemperature - minTemperature, 10);
  const width = 720;
  const height = 250;
  const padding = {
    top: 22,
    right: 24,
    bottom: 40,
    left: 44,
  };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const xForIndex = (index: number) =>
    padding.left + (index / (chartPoints.length - 1)) * innerWidth;
  const yForTemperature = (temperature: number) =>
    padding.top +
    ((maxTemperature - temperature) / temperatureRange) * innerHeight;
  const linePoints = chartPoints
    .map((point, index) => `${xForIndex(index)},${yForTemperature(point.temperature)}`)
    .join(' ');
  const pointStep = innerWidth / (chartPoints.length - 1);
  const handleChartPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const chart = event.currentTarget.querySelector('svg');

    if (!chart) {
      return;
    }

    const bounds = chart.getBoundingClientRect();
    const chartX = ((event.clientX - bounds.left) / bounds.width) * width;
    const rawIndex =
      ((chartX - padding.left) / innerWidth) * (chartPoints.length - 1);
    const nextIndex = Math.min(
      chartPoints.length - 1,
      Math.max(0, Math.round(rawIndex)),
    );

    setHoveredIndex(nextIndex);
  };

  return (
    <section className="hourly-chart" aria-label="Hourly weather and surface forecast">
      <div className="hourly-chart-header">
        <div>
          <h3>Weather Throughout The Day</h3>
          <p>Hourly air temperature with daylight and surface estimates.</p>
        </div>
        <span>{formatHourLabel(activePoint.time)}</span>
      </div>

      <div className="chart-readout" aria-live="polite">
        <article>
          <span>Air</span>
          <strong>{formatTemperature(activePoint.temperature, temperatureUnit)}</strong>
        </article>
        <article>
          <span>Wind</span>
          <strong>{Math.round(activePoint.windSpeed)} mph</strong>
        </article>
        <article>
          <span>Asphalt</span>
          <strong>
            {formatTemperature(activePoint.asphaltTemperature, temperatureUnit)}
          </strong>
        </article>
        <article>
          <span>Cement</span>
          <strong>
            {formatTemperature(activePoint.concreteTemperature, temperatureUnit)}
          </strong>
        </article>
      </div>

      <div className="chart-frame" onPointerMove={handleChartPointerMove}>
        <svg
          className="temperature-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Hourly temperature chart"
        >
          <line
            className="chart-axis"
            x1={padding.left}
            x2={width - padding.right}
            y1={height - padding.bottom}
            y2={height - padding.bottom}
          />
          <line
            className="chart-axis"
            x1={padding.left}
            x2={padding.left}
            y1={padding.top}
            y2={height - padding.bottom}
          />

          {chartPoints.map((point, index) =>
            point.isDay ? (
              <rect
                className="daylight-band"
                height={innerHeight}
                key={`daylight-${point.time}`}
                width={Math.max(pointStep, 1)}
                x={xForIndex(index) - pointStep / 2}
                y={padding.top}
              />
            ) : null,
          )}

          {[minTemperature, maxTemperature].map((temperature) => (
            <g key={temperature}>
              <line
                className="chart-grid-line"
                x1={padding.left}
                x2={width - padding.right}
                y1={yForTemperature(temperature)}
                y2={yForTemperature(temperature)}
              />
              <text
                className="chart-y-label"
                x={padding.left - 10}
                y={yForTemperature(temperature) + 4}
              >
                {formatTemperature(temperature, temperatureUnit)}
              </text>
            </g>
          ))}

          <polyline className="temperature-line" points={linePoints} />

          {chartPoints.map((point, index) => (
            <g key={point.time}>
              {index % 3 === 0 && (
                <text
                  className="chart-x-label"
                  x={xForIndex(index)}
                  y={height - 12}
                >
                  {formatHourLabel(point.time)}
                </text>
              )}
              <circle
                aria-label={`${formatHourLabel(point.time)} ${formatTemperature(
                  point.temperature,
                  temperatureUnit,
                )}`}
                className={index === hoveredIndex ? 'chart-point active' : 'chart-point'}
                cx={xForIndex(index)}
                cy={yForTemperature(point.temperature)}
                onBlur={() => setHoveredIndex(0)}
                onFocus={() => setHoveredIndex(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                r={index === hoveredIndex ? 5 : 3.5}
                tabIndex={0}
              />
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
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
        <span>Paw Pavement</span>
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

      <section className="intro" aria-labelledby="risk-table-title">
        <div className="brand-mark" aria-hidden="true">
          <span className="pad" />
          <span className="toe toe-one" />
          <span className="toe toe-two" />
          <span className="toe toe-three" />
          <span className="toe toe-four" />
        </div>

        <div className="risk-table-section" aria-labelledby="risk-table-title">
          <h2 id="risk-table-title">APPROXIMATE TIME BEFORE MINOR BURN RISK</h2>
          <div className="risk-table-wrap">
            <table className="risk-table">
              <thead>
                <tr>
                  <th scope="col">Surface Temperature</th>
                  <th scope="col">APPROX TIME</th>
                </tr>
              </thead>
              <tbody>
                {burnRiskRows.map(({ temperature, painRisk, riskLevel }) => (
                  <tr className={`risk-row-${riskLevel}`} key={temperature}>
                    <th scope="row">{temperature}</th>
                    <td>{painRisk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="quick-view" aria-label="Pavement quick view">
          <div>
            <p className="quick-label">Maximum Safe Surface</p>
            <strong>
              {formatTemperature(MAX_SAFE_SURFACE_TEMPERATURE, temperatureUnit)}
            </strong>
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

        {weather && (
          <HourlyWeatherChart
            hourly={weather.hourly}
            temperatureUnit={temperatureUnit}
          />
        )}
      </section>
    </main>
  );
}

export default App;
