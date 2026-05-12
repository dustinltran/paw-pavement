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
  hourly: HourlyWeather[];
};

export type HourlyWeather = {
  time: string;
  temperature: number;
  windSpeed: number;
  cloudCover: number;
  isDay: boolean;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    cloud_cover?: number;
    relative_humidity_2m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    wind_speed_10m?: number[];
    cloud_cover?: number[];
    is_day?: number[];
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
    hourly: [
      'temperature_2m',
      'wind_speed_10m',
      'cloud_cover',
      'is_day',
    ].join(','),
    forecast_days: '1',
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

  const currentTemperature = current.temperature_2m;
  const currentWindSpeed = current.wind_speed_10m;
  const currentCloudCover = current.cloud_cover;
  const currentHumidity = current.relative_humidity_2m;
  const hourly = data.hourly;
  const hourlyForecast =
    hourly?.time?.map((time, index) => ({
      time,
      temperature: hourly.temperature_2m?.[index] ?? currentTemperature,
      windSpeed: hourly.wind_speed_10m?.[index] ?? currentWindSpeed,
      cloudCover: hourly.cloud_cover?.[index] ?? currentCloudCover,
      isDay: hourly.is_day?.[index] === 1,
    })) ?? [];

  return {
    temperature: currentTemperature,
    windSpeed: currentWindSpeed,
    cloudCover: currentCloudCover,
    humidity: currentHumidity,
    hourly: hourlyForecast,
  };
}
