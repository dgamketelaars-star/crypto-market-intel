export function calculateAverage(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Current volume divided by its recent average — 1.0 means "typical". */
export function calculateRelativeVolume(currentVolume: number, averageVolume: number | null): number | null {
  if (averageVolume === null || averageVolume === 0 || !Number.isFinite(currentVolume)) return null;
  return currentVolume / averageVolume;
}
