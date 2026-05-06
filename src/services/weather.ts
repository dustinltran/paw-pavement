export type WeatherLocation = {
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type CurrentWeather = {
  temperature: number;
  windSpeed: number;
  cloudCover: number;
  humidity: number;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    cloud_cover?: number;
    relative_humidity_2m?: number;
  };
};

export async function fetchCurrentWeather({
  latitude,
  longitude,
  timezone,
}: WeatherLocation): Promise<CurrentWeather> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: [
      'temperature_2m',
      'wind_speed_10m',
      'cloud_cover',
      'relative_humidity_2m',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
  });

  if (timezone) {
    params.set('timezone', timezone);
  }

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);

  if (!response.ok) {
    throw new Error('Weather request failed.');
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const current = data.current;

  if (
    current?.temperature_2m === undefined ||
    current.wind_speed_10m === undefined ||
    current.cloud_cover === undefined ||
    current.relative_humidity_2m === undefined
  ) {
    throw new Error('Weather data is incomplete.');
  }

  return {
    temperature: current.temperature_2m,
    windSpeed: current.wind_speed_10m,
    cloudCover: current.cloud_cover,
    humidity: current.relative_humidity_2m,
  };
}
