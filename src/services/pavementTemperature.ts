export type PavementSafetyStatus = 'safe' | 'caution' | 'unsafe';

export type PavementEstimateInput = {
  airTemperature: number;
  cloudCover: number;
  windSpeed: number;
};

export type PavementEstimate = {
  asphaltTemperature: number;
  concreteTemperature: number;
  safetyStatus: PavementSafetyStatus;
};

const ASPHALT_SUN_HEAT_GAIN = 35;
const CONCRETE_SUN_HEAT_GAIN = 22;
const WIND_COOLING_PER_MPH = 0.4;
const MAX_WIND_COOLING = 10;
const CAUTION_THRESHOLD = 105;
const UNSAFE_THRESHOLD = 125;

export const MAX_SAFE_SURFACE_TEMPERATURE = CAUTION_THRESHOLD - 5;

export const SURFACE_TEMPERATURE_SCALE = Array.from(
  { length: 10 },
  (_, index) => 85 + index * 5,
);

export function estimateAsphaltTemperature({
  airTemperature,
  cloudCover,
  windSpeed,
}: PavementEstimateInput): number {
  const sunExposure = 1 - cloudCover / 100;
  const windCooling = Math.min(windSpeed * WIND_COOLING_PER_MPH, MAX_WIND_COOLING);

  return airTemperature + ASPHALT_SUN_HEAT_GAIN * sunExposure - windCooling;
}

export function estimateConcreteTemperature({
  airTemperature,
  cloudCover,
  windSpeed,
}: PavementEstimateInput): number {
  const sunExposure = 1 - cloudCover / 100;
  const windCooling = Math.min(windSpeed * WIND_COOLING_PER_MPH, MAX_WIND_COOLING);

  return airTemperature + CONCRETE_SUN_HEAT_GAIN * sunExposure - windCooling;
}

export function getPawSafetyStatus(hottestSurfaceTemperature: number): PavementSafetyStatus {
  if (hottestSurfaceTemperature >= UNSAFE_THRESHOLD) {
    return 'unsafe';
  }

  if (hottestSurfaceTemperature >= CAUTION_THRESHOLD) {
    return 'caution';
  }

  return 'safe';
}

export function estimatePavementTemperature(
  input: PavementEstimateInput,
): PavementEstimate {
  const asphaltTemperature = estimateAsphaltTemperature(input);
  const concreteTemperature = estimateConcreteTemperature(input);
  const hottestSurfaceTemperature = Math.max(asphaltTemperature, concreteTemperature);

  return {
    asphaltTemperature,
    concreteTemperature,
    safetyStatus: getPawSafetyStatus(hottestSurfaceTemperature),
  };
}
