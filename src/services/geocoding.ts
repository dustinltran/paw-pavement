export type LocationResult = {
  id: number;
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type OpenMeteoGeocodingResult = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type OpenMeteoGeocodingResponse = {
  results?: OpenMeteoGeocodingResult[];
};

export function formatLocationName({ name, admin1, country }: LocationResult): string {
  return [name, admin1, country].filter(Boolean).join(', ');
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<LocationResult[]> {
  const params = new URLSearchParams({
    name: query,
    count: '10',
    language: 'en',
    format: 'json',
  });

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error('Location search failed.');
  }

  const data = (await response.json()) as OpenMeteoGeocodingResponse;

  return (data.results ?? [])
    .filter((result) => result.country && result.timezone)
    .map((result) => ({
      id: result.id,
      name: result.name,
      admin1: result.admin1,
      country: result.country ?? '',
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone ?? 'auto',
    }));
}
