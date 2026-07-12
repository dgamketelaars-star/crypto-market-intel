import type { OiSample } from '../engine/historyBuffer';
import { RULES } from '../engine/rules';

export interface OiChangeResult {
  change1hPct: number | null;
  change4hPct: number | null;
  change24hPct: number | null;
}

const HOUR_MS = 60 * 60 * 1000;

function findClosestSampleAtOrBefore(sortedSamples: OiSample[], targetTime: number): OiSample | null {
  let candidate: OiSample | null = null;
  for (const sample of sortedSamples) {
    if (sample.time <= targetTime) candidate = sample;
    else break;
  }
  if (candidate && targetTime - candidate.time > RULES.openInterest.maxSampleGapMs) return null;
  return candidate;
}

/** % change of open interest from `hours` ago to `current`, or null if no sample old enough exists. */
export function calculateOiChange(
  current: number,
  currentTime: number,
  history: OiSample[],
): OiChangeResult {
  const sorted = [...history].sort((a, b) => a.time - b.time);

  const changeFor = (hours: number): number | null => {
    const target = currentTime - hours * HOUR_MS;
    const base = findClosestSampleAtOrBefore(sorted, target);
    if (!base || base.openInterest === 0) return null;
    return ((current - base.openInterest) / base.openInterest) * 100;
  };

  return {
    change1hPct: changeFor(1),
    change4hPct: changeFor(4),
    change24hPct: changeFor(24),
  };
}
