import { useCallback, useMemo, useState } from 'react';
import type { SymbolAnalysis } from '../analysis/engine/types';
import type { SymbolResolution } from '../setups/engine/conflictResolution';
import type { GeneratedSetup } from '../setups/engine/types';
import { buildTrendBreakoutCandles, type ScenarioOutcome } from '../setups/simulation/scenarioBuilder';
import { runSimulationTick } from '../setups/simulation/simulationEngine';

export interface SimulationScenarioOption {
  id: string;
  label: string;
  description: string;
  outcome: ScenarioOutcome;
}

export const SIMULATION_SCENARIOS: SimulationScenarioOption[] = [
  {
    id: 'continue',
    label: 'Trend continuation → target',
    description: 'Uptrend, consolidatie, bevestigde breakout met volume, koersdoel bereikt.',
    outcome: 'continue',
  },
  {
    id: 'reverse',
    label: 'Failed breakout → invalidation',
    description: 'Zelfde opzet, maar de breakout faalt en de prijs zakt door het invalidation-niveau.',
    outcome: 'reverse',
  },
  {
    id: 'stall',
    label: 'Geen bevestiging → expiratie',
    description: 'Consolidatie zonder ooit te bevestigen — de candidate verloopt na het maximale tijdvenster.',
    outcome: 'stall',
  },
];

const SYMBOL = 'SIMUSDT';
const START_INDEX = 210 + 35;

interface SimulationState {
  tickIndex: number;
  setups: GeneratedSetup[];
  analysis: SymbolAnalysis | null;
  price: number | null;
  resolution: SymbolResolution | null;
  /** Only advances on a non-stale tick — lets the UI demo "stale data" by freezing this instead of always reading Date.now(). */
  priceUpdatedAt: number | null;
}

const INITIAL_STATE: SimulationState = {
  tickIndex: START_INDEX,
  setups: [],
  analysis: null,
  price: null,
  resolution: null,
  priceUpdatedAt: null,
};

export function useSimulation() {
  const [scenarioId, setScenarioId] = useState(SIMULATION_SCENARIOS[0].id);
  const [state, setState] = useState<SimulationState>(INITIAL_STATE);
  // Manual override so a tester can force "stale data while active" on demand,
  // instead of needing a dedicated candle fixture for it.
  const [forceStale, setForceStale] = useState(false);

  const scenario = SIMULATION_SCENARIOS.find((s) => s.id === scenarioId) ?? SIMULATION_SCENARIOS[0];
  const candles = useMemo(() => buildTrendBreakoutCandles({ outcome: scenario.outcome }), [scenario.outcome]);

  const selectScenario = useCallback((id: string) => {
    setScenarioId(id);
    setState(INITIAL_STATE);
    setForceStale(false);
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setForceStale(false);
  }, []);

  const step = useCallback(() => {
    setState((prev) => {
      if (prev.tickIndex >= candles.length) return prev;
      const candles1hSoFar = candles.slice(0, prev.tickIndex + 1);
      const now = candles1hSoFar[candles1hSoFar.length - 1].closeTime + 1;
      const result = runSimulationTick({ symbol: SYMBOL, candles1hSoFar, now, existing: prev.setups, priceIsStale: forceStale });
      return {
        tickIndex: prev.tickIndex + 1,
        setups: result.setups,
        analysis: result.analysis,
        price: result.price,
        resolution: result.resolution,
        priceUpdatedAt: forceStale ? prev.priceUpdatedAt : Date.now(),
      };
    });
  }, [candles, forceStale]);

  const canStep = state.tickIndex < candles.length;
  const progress = { current: state.tickIndex - START_INDEX, total: candles.length - START_INDEX };

  return {
    symbol: SYMBOL,
    scenarios: SIMULATION_SCENARIOS,
    scenarioId,
    selectScenario,
    setups: state.setups,
    analysis: state.analysis,
    price: state.price,
    priceUpdatedAt: state.priceUpdatedAt,
    resolution: state.resolution,
    step,
    canStep,
    reset,
    progress,
    forceStale,
    setForceStale,
  };
}
