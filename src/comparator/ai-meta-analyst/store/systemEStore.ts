import { marketDataStore } from '../../../store/marketDataStore';
import { setupStore } from '../../../setups/store/setupStore';
import { OPEN_SETUP_STATUSES } from '../../../setups/engine/types';
import { systemBStore } from '../../open-source-strategy/store/systemBStore';
import { toNormalisedStrategySetup } from '../../open-source-strategy/adapters/toNormalisedSetup';
import { systemCStore } from '../../independent-analysis/store/systemCStore';
import { toIndependentAnalysisSetup } from '../../independent-analysis/adapters/toIndependentAnalysisSetup';
import { systemDStore } from '../../ichimoku-analysis/store/systemDStore';
import { toIchimokuAnalysisSetup } from '../../ichimoku-analysis/adapters/toIchimokuAnalysisSetup';
import { systemEApiKeyStore } from '../settings/apiKeyStore';
import { selectSymbolsToAnalyze, type SymbolDirectionInput } from '../selection/selectSymbolsToAnalyze';
import type { RawMarketSnapshot, SystemOutputSummary } from '../prompt/buildPrompt';
import { runMetaAnalysis } from '../analysis/runMetaAnalysis';
import { createSystemERecord, type SystemERecord } from '../records/systemERecord';
import { createLogEntry, type SystemELogEntry } from '../logging/systemELog';
import { systemERecordPersistence, systemELogPersistence } from '../persistence/systemEPersistence';

/** Own choice: far longer than A-D's 5s cadence — every call is real, billed API spend on the user's own key. */
const RECOMPUTE_INTERVAL_MS = 20 * 60_000;
/** Own choice: cap spend per cycle regardless of how many symbols qualify. */
const MAX_SYMBOLS_PER_CYCLE = 3;
/** Own choice: don't re-analyze the same symbol more often than this, even on manual trigger spam. */
const MIN_RECHECK_INTERVAL_MS = 15 * 60_000;
const TEARDOWN_GRACE_MS = 300;
const CANDLE_4H_COUNT = 60;
const CANDLE_1H_COUNT = 48;

export interface SystemEStoreState {
  records: Record<string, SystemERecord>;
  log: SystemELogEntry[];
  lastEvaluatedAt: number | null;
  analyzing: Set<string>;
}

type Listener = () => void;

function buildSystemASummary(symbol: string): SystemOutputSummary {
  const setup = Object.values(setupStore.getState().setups).find((s) => s.symbol === symbol && OPEN_SETUP_STATUSES.includes(s.status));
  if (!setup) return { systemId: 'A', systemName: 'Onze analist', hasSetup: false, reasoning: [], warnings: [] };
  return {
    systemId: 'A',
    systemName: 'Onze analist',
    hasSetup: true,
    direction: setup.direction,
    status: setup.status,
    confidenceOrStrength: `${setup.signalStrength} (risk: ${setup.risk})`,
    entryDescription: setup.entryZone ? `${setup.entryZone.low}-${setup.entryZone.high}` : `trigger ${setup.trigger.price}`,
    stopPrice: setup.invalidation.price,
    targets: setup.targets.map((t) => t.price),
    reasoning: setup.supporting.map((e) => e.detail),
    warnings: setup.opposing.map((e) => e.detail),
  };
}

function buildSystemBSummary(symbol: string, now: number): SystemOutputSummary {
  const setup = Object.values(systemBStore.getState().setups).find((s) => s.symbol === symbol && (s.status === 'entry_triggered' || s.status === 'active'));
  if (!setup) return { systemId: 'B', systemName: 'Open-source model (Supertrend)', hasSetup: false, reasoning: [], warnings: [] };
  const normalised = toNormalisedStrategySetup(setup, now);
  return {
    systemId: 'B',
    systemName: 'Open-source model (Supertrend)',
    hasSetup: true,
    direction: normalised.direction,
    status: normalised.status,
    confidenceOrStrength: undefined,
    entryDescription: normalised.entryZone ? `${normalised.entryZone.low}-${normalised.entryZone.high}` : `trigger ${normalised.triggerPrice ?? ''}`,
    stopPrice: normalised.stopPrice ?? null,
    targets: normalised.targets?.map((t: { price: number }) => t.price) ?? [],
    reasoning: normalised.reasonSummary,
    warnings: [],
  };
}

function buildSystemCSummary(symbol: string): SystemOutputSummary {
  const setup = Object.values(systemCStore.getState().setups).find((s) => s.symbol === symbol && (s.status === 'entry_zone_now' || s.status === 'active'));
  if (!setup) return { systemId: 'C', systemName: 'Onafhankelijke analyse (structuur/liquidity)', hasSetup: false, reasoning: [], warnings: [] };
  const normalised = toIndependentAnalysisSetup(setup);
  return {
    systemId: 'C',
    systemName: 'Onafhankelijke analyse (structuur/liquidity)',
    hasSetup: true,
    direction: normalised.direction,
    status: normalised.status,
    confidenceOrStrength: undefined,
    entryDescription: normalised.entryZone ? `${normalised.entryZone.low}-${normalised.entryZone.high}` : undefined,
    stopPrice: normalised.stopPrice ?? null,
    targets: normalised.targets?.map((t) => t.price) ?? [],
    reasoning: normalised.supportingObservations,
    warnings: normalised.opposingObservations,
  };
}

function buildSystemDSummary(symbol: string): SystemOutputSummary {
  const setup = Object.values(systemDStore.getState().setups).find((s) => s.symbol === symbol && (s.status === 'entry_zone_now' || s.status === 'active'));
  if (!setup) return { systemId: 'D', systemName: 'Ichimoku Analysis', hasSetup: false, reasoning: [], warnings: [] };
  const normalised = toIchimokuAnalysisSetup(setup);
  return {
    systemId: 'D',
    systemName: 'Ichimoku Analysis',
    hasSetup: true,
    direction: normalised.direction,
    status: normalised.status,
    confidenceOrStrength: normalised.confidence,
    entryDescription: normalised.entryZone ? `${normalised.entryZone.low}-${normalised.entryZone.high}` : undefined,
    stopPrice: normalised.stopPrice ?? null,
    targets: normalised.targets?.map((t) => t.price) ?? [],
    reasoning: normalised.supportingObservations,
    warnings: normalised.opposingObservations,
  };
}

function buildMarketSnapshot(symbol: string): RawMarketSnapshot | null {
  const marketData = marketDataStore.getState().bySymbol[symbol];
  if (!marketData?.ticker) return null;
  const candles4h = (marketData.candles['4h'] ?? []).slice(-CANDLE_4H_COUNT);
  const candles1h = (marketData.candles['1h'] ?? []).slice(-CANDLE_1H_COUNT);
  if (candles4h.length < 10 || candles1h.length < 10) return null;
  return {
    symbol,
    price: marketData.ticker.lastPrice,
    candles4h,
    candles1h,
    fundingRatePct: marketData.funding ? marketData.funding.fundingRate * 100 : null,
    openInterestValue: marketData.openInterest?.openInterest ?? null,
    longShortRatio: marketData.longShortRatio?.longShortRatio ?? null,
    recentLiquidationCount: marketData.recentLiquidations.length,
  };
}

/**
 * Orchestration store for System E. Deliberately NOT built on the same
 * 5-second recompute pattern as A-D's stores — every recompute here is a
 * real, billed LLM call, so this runs on a long interval and only on a
 * capped, selected subset of symbols. Reads A-D's PUBLISHED OUTPUT via their
 * public stores/adapters only — never their internal evidence/signal logic.
 */
export class SystemEStore {
  private state: SystemEStoreState = { records: {}, log: [], lastEvaluatedAt: null, analyzing: new Set() };
  private listeners = new Set<Listener>();
  private consumerCount = 0;
  private teardownTimer: ReturnType<typeof setTimeout> | null = null;
  private recomputeTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private lastAnalyzedAt: Record<string, number> = {};

  getState = (): SystemEStoreState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  connectConsumer(): void {
    this.consumerCount += 1;
    if (this.teardownTimer) {
      clearTimeout(this.teardownTimer);
      this.teardownTimer = null;
    }
    if (!this.started) this.start();
  }

  disconnectConsumer(): void {
    this.consumerCount = Math.max(0, this.consumerCount - 1);
    if (this.consumerCount === 0 && !this.teardownTimer) {
      this.teardownTimer = setTimeout(() => this.stop(), TEARDOWN_GRACE_MS);
    }
  }

  private setState(patch: Partial<SystemEStoreState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private start(): void {
    this.started = true;
    const restored: Record<string, SystemERecord> = {};
    for (const record of systemERecordPersistence.load()) {
      restored[record.symbol] = record;
      this.lastAnalyzedAt[record.symbol] = record.generatedAt;
    }
    this.state = { records: restored, log: systemELogPersistence.load(), lastEvaluatedAt: null, analyzing: new Set() };

    this.tick();
    this.recomputeTimer = setInterval(() => this.tick(), RECOMPUTE_INTERVAL_MS);
  }

  private stop(): void {
    this.started = false;
    if (this.recomputeTimer) clearInterval(this.recomputeTimer);
    this.recomputeTimer = null;
  }

  private gatherSummaries(symbol: string, now: number): SystemOutputSummary[] {
    return [buildSystemASummary(symbol), buildSystemBSummary(symbol, now), buildSystemCSummary(symbol), buildSystemDSummary(symbol)];
  }

  private buildDirectionInputs(now: number): SymbolDirectionInput[] {
    const { universe } = marketDataStore.getState();
    return universe.map(({ symbol }) => {
      const summaries = this.gatherSummaries(symbol, now);
      const directions = summaries.filter((s): s is SystemOutputSummary & { direction: 'LONG' | 'SHORT' } => s.hasSetup && s.direction != null).map((s) => s.direction);
      return { symbol, directions };
    });
  }

  private async analyzeSymbol(symbol: string, reason: 'strong_consensus' | 'disagreement', now: number): Promise<void> {
    const provider = systemEApiKeyStore.getProvider();
    const apiKey = systemEApiKeyStore.getApiKey(provider);
    if (!apiKey) return;
    const market = buildMarketSnapshot(symbol);
    if (!market) return;

    this.setState({ analyzing: new Set(this.state.analyzing).add(symbol) });
    const summaries = this.gatherSummaries(symbol, now);
    const model = systemEApiKeyStore.getModel(provider);
    const outcome = await runMetaAnalysis({ provider, apiKey, model, symbol, systemSummaries: summaries, market });

    const stillAnalyzing = new Set(this.state.analyzing);
    stillAnalyzing.delete(symbol);

    if (outcome.ok) {
      const record = createSystemERecord(symbol, outcome.model, reason, summaries, outcome.result, outcome.usage, now);
      const nextRecords = { ...this.state.records, [symbol]: record };
      const nextLog = systemELogPersistence.append(createLogEntry(symbol, now, { success: true, model: outcome.model, ...outcome.usage }));
      this.lastAnalyzedAt[symbol] = now;
      this.setState({ records: nextRecords, log: nextLog, analyzing: stillAnalyzing });
      systemERecordPersistence.save(Object.values(nextRecords));
    } else {
      const nextLog = systemELogPersistence.append(createLogEntry(symbol, now, { success: false, errorType: outcome.errorType, errorMessage: outcome.errorMessage }));
      this.lastAnalyzedAt[symbol] = now;
      this.setState({ log: nextLog, analyzing: stillAnalyzing });
    }
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    this.setState({ lastEvaluatedAt: now });
    if (!systemEApiKeyStore.hasApiKey()) return;

    const inputs = this.buildDirectionInputs(now);
    const selected = selectSymbolsToAnalyze(inputs, MAX_SYMBOLS_PER_CYCLE);
    for (const { symbol, reason } of selected) {
      const last = this.lastAnalyzedAt[symbol];
      if (last && now - last < MIN_RECHECK_INTERVAL_MS) continue;
      await this.analyzeSymbol(symbol, reason, now);
    }
  }

  /** Manual on-demand trigger (e.g. a UI button), bypassing the selection filter but still respecting the recheck cooldown. */
  async analyzeSymbolNow(symbol: string): Promise<void> {
    const now = Date.now();
    const last = this.lastAnalyzedAt[symbol];
    if (last && now - last < MIN_RECHECK_INTERVAL_MS) return;
    const inputs = this.buildDirectionInputs(now).find((i) => i.symbol === symbol);
    const reason: 'strong_consensus' | 'disagreement' = inputs && inputs.directions.length >= 2 && inputs.directions.every((d) => d === inputs.directions[0]) ? 'strong_consensus' : 'disagreement';
    await this.analyzeSymbol(symbol, reason, now);
  }

  reset(): void {
    this.state = { records: {}, log: [], lastEvaluatedAt: null, analyzing: new Set() };
    this.lastAnalyzedAt = {};
    systemERecordPersistence.clear();
    systemELogPersistence.clear();
    this.listeners.forEach((listener) => listener());
  }
}

export const systemEStore = new SystemEStore();
