import { describe, expect, it } from 'vitest';
import type { SetupStatus } from '../engine/types';
import { buildTrendBreakoutCandles } from './scenarioBuilder';
import { runSimulationScenario } from './simulationEngine';

describe('runSimulationScenario — continue outcome', () => {
  it('progresses a trend_continuation_breakout LONG through waiting_for_confirmation to active', () => {
    const candles = buildTrendBreakoutCandles({ outcome: 'continue' });
    const { ticks } = runSimulationScenario({ symbol: 'SIMUSDT', fullCandles: candles, startIndex: 210 + 35 });

    const statusesSeen = new Set(
      ticks
        .map((t) => t.setups.find((s) => s.family === 'trend_continuation_breakout' && s.direction === 'LONG')?.status)
        .filter((s): s is SetupStatus => Boolean(s)),
    );

    expect(statusesSeen.has('waiting_for_confirmation')).toBe(true);
    expect(statusesSeen.has('active')).toBe(true);
  });

  it('tags every generated setup with origin "simulation"', () => {
    const candles = buildTrendBreakoutCandles({ outcome: 'continue' });
    const { finalSetups } = runSimulationScenario({ symbol: 'SIMUSDT', fullCandles: candles, startIndex: 210 + 35 });
    expect(finalSetups.length).toBeGreaterThan(0);
    expect(finalSetups.every((s) => s.origin === 'simulation')).toBe(true);
  });
});

describe('runSimulationScenario — reverse outcome', () => {
  it('eventually invalidates the breakout setup when the move fails', () => {
    const candles = buildTrendBreakoutCandles({ outcome: 'reverse' });
    const { finalSetups } = runSimulationScenario({ symbol: 'SIMUSDT', fullCandles: candles, startIndex: 210 + 35 });
    const breakout = finalSetups.find((s) => s.family === 'trend_continuation_breakout' && s.direction === 'LONG');
    expect(breakout?.status).toBe('invalidated');
  });
});

describe('runSimulationScenario — stall outcome', () => {
  it('never activates when confirmation never arrives', () => {
    const candles = buildTrendBreakoutCandles({ outcome: 'stall' });
    const { finalSetups } = runSimulationScenario({ symbol: 'SIMUSDT', fullCandles: candles, startIndex: 210 + 35 });
    const breakout = finalSetups.find((s) => s.family === 'trend_continuation_breakout' && s.direction === 'LONG');
    expect(breakout?.status).not.toBe('active');
  });
});
