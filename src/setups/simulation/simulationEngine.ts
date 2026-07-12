import { analyseSymbol } from '../../analysis/engine/analyseSymbol';
import type { SymbolAnalysis } from '../../analysis/engine/types';
import type { Candle, TickerData } from '../../services/binance/types';
import { evaluateSymbolSetups } from '../engine/evaluateSymbolSetups';
import type { SymbolResolution } from '../engine/conflictResolution';
import type { GeneratedSetup } from '../engine/types';

/** Builds higher-timeframe candles from 1H data by grouping — only complete groups count, so the "currently forming" higher-TF bar simply isn't represented yet (same as live data). */
export function aggregateCandles(candles1h: Candle[], groupSize: number): Candle[] {
  const result: Candle[] = [];
  for (let i = 0; i + groupSize <= candles1h.length; i += groupSize) {
    const group = candles1h.slice(i, i + groupSize);
    result.push({
      openTime: group[0].openTime,
      closeTime: group[group.length - 1].closeTime,
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0),
      isFinal: group[group.length - 1].isFinal,
    });
  }
  return result;
}

export interface SimulationTickResult {
  now: number;
  price: number;
  analysis: SymbolAnalysis;
  setups: GeneratedSetup[];
  resolution: SymbolResolution;
}

/**
 * Runs the real analysis engine and the real setup engine against fixture
 * candles — no network, no live stores touched. This is the same pipeline
 * live mode uses, just fed synthetic data, so simulated behaviour is a
 * faithful test of the actual rules.
 */
export function runSimulationTick(params: {
  symbol: string;
  candles1hSoFar: Candle[];
  now: number;
  existing: GeneratedSetup[];
  btcAnalysis?: SymbolAnalysis | null;
  quoteVolumeRank?: number | null;
  universeSize?: number | null;
  priceIsStale?: boolean;
}): SimulationTickResult {
  const closeCandle = params.candles1hSoFar[params.candles1hSoFar.length - 1];
  const lastPrice = closeCandle.close;
  const ticker: TickerData = {
    symbol: params.symbol,
    lastPrice,
    priceChangePercent: 0,
    quoteVolume: closeCandle.volume * lastPrice,
    time: params.now,
  };

  const analysis = analyseSymbol({
    symbol: params.symbol,
    candles: {
      '1h': params.candles1hSoFar,
      '4h': aggregateCandles(params.candles1hSoFar, 4),
      '1d': aggregateCandles(params.candles1hSoFar, 24),
    },
    ticker,
    funding: undefined,
    openInterest: undefined,
    quoteVolumeRank: params.quoteVolumeRank ?? 1,
    universeSize: params.universeSize ?? 20,
    oiHistory: [],
    fundingHistory: [],
    calculatedAt: params.now,
  });

  const { setups, resolution } = evaluateSymbolSetups({
    symbol: params.symbol,
    price: lastPrice,
    analysis,
    candles1h: params.candles1hSoFar,
    btcAnalysis: params.btcAnalysis ?? null,
    ethAnalysis: null,
    now: params.now,
    existingForSymbol: params.existing,
    origin: 'simulation',
    priceIsStale: params.priceIsStale ?? false,
  });

  return { now: params.now, price: lastPrice, analysis, setups, resolution };
}

export interface ScenarioRunResult {
  ticks: SimulationTickResult[];
  finalSetups: GeneratedSetup[];
}

/** Plays a full fixture candle sequence tick by tick, feeding each tick's output setups into the next. */
export function runSimulationScenario(params: {
  symbol: string;
  fullCandles: Candle[];
  startIndex?: number;
  btcAnalysis?: SymbolAnalysis | null;
}): ScenarioRunResult {
  const startIndex = params.startIndex ?? Math.min(210, params.fullCandles.length - 1);
  let existing: GeneratedSetup[] = [];
  const ticks: SimulationTickResult[] = [];

  for (let i = startIndex; i < params.fullCandles.length; i++) {
    const candlesSoFar = params.fullCandles.slice(0, i + 1);
    const now = candlesSoFar[candlesSoFar.length - 1].closeTime + 1;
    const result = runSimulationTick({
      symbol: params.symbol,
      candles1hSoFar: candlesSoFar,
      now,
      existing,
      btcAnalysis: params.btcAnalysis,
    });
    existing = result.setups;
    ticks.push(result);
  }

  return { ticks, finalSetups: existing };
}
