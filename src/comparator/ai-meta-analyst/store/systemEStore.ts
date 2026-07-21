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
import { selectSymbolsToAnalyze, computeSelectionSignature, type SymbolOpinionInput, type SystemOpinion, type SystemOpinionConfidence } from '../selection/selectSymbolsToAnalyze';
import type { RawMarketSnapshot } from '../prompt/marketData';
import type { SystemOutputSummary } from '../prompt/systemSummary';
import { runPhase1Analysis, runPhase2Analysis } from '../analysis/runMetaAnalysis';
import { createSystemERecord, type SystemERecord, type SystemETriggerType } from '../records/systemERecord';
import { createSuccessLogEntry, createFailureLogEntry, type SystemELogEntry } from '../logging/systemELog';
import { systemERecordPersistence, systemELogPersistence } from '../persistence/systemEPersistence';

/** Own choice: far longer than A-D's 5s cadence — every call is real, billed API spend on the user's own key. */
const RECOMPUTE_INTERVAL_MS = 20 * 60_000;
/** Own choice: cap spend per cycle regardless of how many symbols qualify. Each analysis is now two LLM calls (phase 1 + phase 2), so this caps at most 2 * MAX_SYMBOLS_PER_CYCLE calls per tick. */
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

interface SystemInfo {
  summary: SystemOutputSummary;
  opinion: SystemOpinion | null;
}

function midpoint(zone: { low: number; high: number } | null | undefined): number | null {
  return zone ? (zone.low + zone.high) / 2 : null;
}

function buildSystemA(symbol: string): SystemInfo {
  const setup = Object.values(setupStore.getState().setups).find((s) => s.symbol === symbol && OPEN_SETUP_STATUSES.includes(s.status));
  if (!setup) return { summary: { systemId: 'A', systemName: 'Onze analist', hasSetup: false, reasoning: [], warnings: [] }, opinion: null };
  const confidenceMap: Record<string, SystemOpinionConfidence> = { Low: 'low', Medium: 'medium', High: 'high', 'Very high': 'high' };
  const entryPrice = midpoint(setup.entryZone) ?? setup.trigger.price;
  return {
    summary: {
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
    },
    opinion: { direction: setup.direction, confidence: confidenceMap[setup.signalStrength] ?? null, entryPrice, stopPrice: setup.invalidation.price },
  };
}

function buildSystemB(symbol: string, now: number): SystemInfo {
  const setup = Object.values(systemBStore.getState().setups).find((s) => s.symbol === symbol && (s.status === 'entry_triggered' || s.status === 'active'));
  if (!setup) return { summary: { systemId: 'B', systemName: 'Open-source model (Supertrend)', hasSetup: false, reasoning: [], warnings: [] }, opinion: null };
  const normalised = toNormalisedStrategySetup(setup, now);
  const entryPrice = midpoint(normalised.entryZone) ?? normalised.triggerPrice ?? null;
  return {
    summary: {
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
    },
    opinion: { direction: normalised.direction, confidence: null, entryPrice, stopPrice: normalised.stopPrice ?? null },
  };
}

function buildSystemC(symbol: string): SystemInfo {
  const setup = Object.values(systemCStore.getState().setups).find((s) => s.symbol === symbol && (s.status === 'entry_zone_now' || s.status === 'active'));
  if (!setup) return { summary: { systemId: 'C', systemName: 'Onafhankelijke analyse (structuur/liquidity)', hasSetup: false, reasoning: [], warnings: [] }, opinion: null };
  const normalised = toIndependentAnalysisSetup(setup);
  const entryPrice = midpoint(normalised.entryZone);
  return {
    summary: {
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
    },
    opinion: { direction: normalised.direction, confidence: null, entryPrice, stopPrice: normalised.stopPrice ?? null },
  };
}

function buildSystemD(symbol: string): SystemInfo {
  const setup = Object.values(systemDStore.getState().setups).find((s) => s.symbol === symbol && (s.status === 'entry_zone_now' || s.status === 'active'));
  if (!setup) return { summary: { systemId: 'D', systemName: 'Ichimoku Analysis', hasSetup: false, reasoning: [], warnings: [] }, opinion: null };
  const normalised = toIchimokuAnalysisSetup(setup);
  const confidenceMap: Record<string, SystemOpinionConfidence> = { strong: 'high', moderate: 'medium' };
  const entryPrice = midpoint(normalised.entryZone);
  return {
    summary: {
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
    },
    opinion: { direction: normalised.direction, confidence: confidenceMap[normalised.confidence] ?? null, entryPrice, stopPrice: normalised.stopPrice ?? null },
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
 * 5-second recompute pattern as A-D's stores — every recompute here is one
 * or two real, billed LLM calls, so this runs on a long interval and only
 * on a capped, selected subset of symbols. Reads A-D's PUBLISHED OUTPUT via
 * their public stores/adapters only — never their internal evidence/signal
 * logic. Runs phase 1 (independent) fully before phase 2 ever sees A-D's
 * output — see analysis/runMetaAnalysis.ts and prompt/phase1Prompt.ts.
 */
export class SystemEStore {
  private state: SystemEStoreState = { records: {}, log: [], lastEvaluatedAt: null, analyzing: new Set() };
  private listeners = new Set<Listener>();
  private consumerCount = 0;
  private teardownTimer: ReturnType<typeof setTimeout> | null = null;
  private recomputeTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private lastAnalyzedAt: Record<string, number> = {};
  /** In-memory only, soft heuristic — see selection/selectSymbolsToAnalyze.ts#computeSelectionSignature. Resets on reload, which is fine: a fresh page load re-evaluating once more is a non-issue. */
  private lastAnalyzedSignature: Record<string, string> = {};

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

  private gatherSystemInfo(symbol: string, now: number): SystemInfo[] {
    return [buildSystemA(symbol), buildSystemB(symbol, now), buildSystemC(symbol), buildSystemD(symbol)];
  }

  private buildOpinionInputs(now: number): SymbolOpinionInput[] {
    const { universe } = marketDataStore.getState();
    return universe.map(({ symbol }) => {
      const infos = this.gatherSystemInfo(symbol, now);
      const opinions = infos.filter((i): i is SystemInfo & { opinion: SystemOpinion } => i.opinion !== null).map((i) => i.opinion);
      return { symbol, opinions };
    });
  }

  private async analyzeSymbol(symbol: string, triggerType: SystemETriggerType, selectionReason: SystemERecord['selectionReason'], now: number): Promise<void> {
    const provider = systemEApiKeyStore.getProvider();
    const apiKey = systemEApiKeyStore.getApiKey(provider);
    if (!apiKey) return;
    const market = buildMarketSnapshot(symbol);
    if (!market) return;

    this.setState({ analyzing: new Set(this.state.analyzing).add(symbol) });
    const infos = this.gatherSystemInfo(symbol, now);
    const summaries = infos.map((i) => i.summary);
    const model = systemEApiKeyStore.getModel(provider);

    const phase1Outcome = await runPhase1Analysis({ provider, apiKey, model, market });

    if (!phase1Outcome.ok) {
      const stillAnalyzing = new Set(this.state.analyzing);
      stillAnalyzing.delete(symbol);
      const nextLog = systemELogPersistence.append(
        createFailureLogEntry({ symbol, now, triggerType, selectionReason, errorPhase: 'phase1', errorType: phase1Outcome.errorType, errorMessage: phase1Outcome.errorMessage, provider, model }),
      );
      this.lastAnalyzedAt[symbol] = now;
      this.setState({ log: nextLog, analyzing: stillAnalyzing });
      return;
    }

    const phase2Outcome = await runPhase2Analysis({ provider, apiKey, model, symbol, phase1: phase1Outcome.result, systemSummaries: summaries });

    const stillAnalyzing = new Set(this.state.analyzing);
    stillAnalyzing.delete(symbol);

    if (!phase2Outcome.ok) {
      const nextLog = systemELogPersistence.append(
        createFailureLogEntry({
          symbol,
          now,
          triggerType,
          selectionReason,
          errorPhase: 'phase2',
          errorType: phase2Outcome.errorType,
          errorMessage: phase2Outcome.errorMessage,
          provider,
          model,
          phase1Usage: phase1Outcome.usage,
          initialDecision: phase1Outcome.result.decision,
          initialConfidence: phase1Outcome.result.confidence,
          initialSetupQuality: phase1Outcome.result.setupQuality,
        }),
      );
      this.lastAnalyzedAt[symbol] = now;
      this.setState({ log: nextLog, analyzing: stillAnalyzing });
      return;
    }

    const record = createSystemERecord(symbol, provider, model, triggerType, selectionReason, summaries, phase1Outcome.result, phase2Outcome.result, phase1Outcome.usage, phase2Outcome.usage, now);
    const nextRecords = { ...this.state.records, [symbol]: record };
    const nextLog = systemELogPersistence.append(createSuccessLogEntry(record));
    this.lastAnalyzedAt[symbol] = now;
    const price = market.price;
    const opinionInput = infos.filter((i): i is SystemInfo & { opinion: SystemOpinion } => i.opinion !== null).map((i) => i.opinion);
    this.lastAnalyzedSignature[symbol] = computeSelectionSignature({ symbol, opinions: opinionInput }, price);
    this.setState({ records: nextRecords, log: nextLog, analyzing: stillAnalyzing });
    systemERecordPersistence.save(Object.values(nextRecords));
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    this.setState({ lastEvaluatedAt: now });
    if (!systemEApiKeyStore.hasApiKey()) return;

    const inputs = this.buildOpinionInputs(now);
    const selected = selectSymbolsToAnalyze(inputs, MAX_SYMBOLS_PER_CYCLE);
    for (const { symbol, reason } of selected) {
      const last = this.lastAnalyzedAt[symbol];
      if (last && now - last < MIN_RECHECK_INTERVAL_MS) continue;

      const input = inputs.find((i) => i.symbol === symbol);
      const marketData = marketDataStore.getState().bySymbol[symbol];
      if (input && marketData?.ticker) {
        const signature = computeSelectionSignature(input, marketData.ticker.lastPrice);
        if (this.lastAnalyzedSignature[symbol] === signature) continue; // relevant data barely changed since last analysis — skip the spend
      }

      await this.analyzeSymbol(symbol, 'automatic', reason, now);
    }
  }

  /** Manual on-demand trigger (e.g. a UI button) — works for ANY symbol in the shared universe, not just automatically-selected candidates, bypassing the selection filter and the unchanged-data skip, but still respecting the recheck cooldown so repeated clicks can't spam the API. */
  async analyzeSymbolNow(symbol: string): Promise<void> {
    const now = Date.now();
    const last = this.lastAnalyzedAt[symbol];
    if (last && now - last < MIN_RECHECK_INTERVAL_MS) return;
    await this.analyzeSymbol(symbol, 'manual', null, now);
  }

  reset(): void {
    this.state = { records: {}, log: [], lastEvaluatedAt: null, analyzing: new Set() };
    this.lastAnalyzedAt = {};
    this.lastAnalyzedSignature = {};
    systemERecordPersistence.clear();
    systemELogPersistence.clear();
    this.listeners.forEach((listener) => listener());
  }
}

export const systemEStore = new SystemEStore();
