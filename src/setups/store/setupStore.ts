import { analysisStore } from '../../analysis/engine/analysisStore';
import { SETUP_GENERATION_ENABLED } from '../../intelligence/generationStatus';
import { computeBreadthBullishSharePct } from '../../intelligence/marketBreadth';
import { expireVanishedUniverseSetup, orchestrateSymbolSetup } from '../../intelligence/orchestrateSymbol';
import { marketDataStore } from '../../store/marketDataStore';
import { isStale, STALE_AFTER_MS } from '../../utils/freshness';
import type { SymbolResolution } from '../engine/conflictResolution';
import { type GeneratedSetup } from '../engine/types';
import { localStorageSetupPersistence } from '../persistence/localStoragePersistence';
import type { SetupPersistenceAdapter } from '../persistence/persistenceAdapter';

const RECOMPUTE_INTERVAL_MS = 5_000;
const TEARDOWN_GRACE_MS = 300;

export interface SetupStoreState {
  setups: Record<string, GeneratedSetup>;
  /**
   * Per-symbol LONG/SHORT conflict-resolution outcome — a relic of the
   * paused family-pattern engine, which could produce simultaneous LONG and
   * SHORT candidates for one symbol. The intelligence pipeline's decision
   * flow never does (decideThesis resolves to one direction or NO_THESIS by
   * construction), so this stays permanently empty; kept only so
   * DebugSetupStatePanel's existing "activation conflict" view doesn't need
   * a separate code path — an empty result there is now the correct,
   * honest answer, not a stub.
   */
  resolutions: Record<string, SymbolResolution>;
  lastEvaluatedAt: number | null;
  /** True while the setup engine is being rebuilt (see src/intelligence/generationStatus.ts) — no setups publish while this is true. */
  recalibrating: boolean;
}

type Listener = () => void;

/**
 * Live and simulation setup stores share this exact class — only the
 * persistence adapter, origin tag and (for simulation) the data source
 * differ. Both consume the existing market-data/analysis stores read-only;
 * neither opens its own REST/WebSocket connections.
 */
export class SetupStore {
  private state: SetupStoreState = { setups: {}, resolutions: {}, lastEvaluatedAt: null, recalibrating: !SETUP_GENERATION_ENABLED };
  private listeners = new Set<Listener>();
  private consumerCount = 0;
  private teardownTimer: ReturnType<typeof setTimeout> | null = null;
  private recomputeTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeMarketData: (() => void) | null = null;
  private unsubscribeAnalysis: (() => void) | null = null;
  private started = false;
  private dirty = true;
  private readonly persistence: SetupPersistenceAdapter;
  private readonly origin: 'live' | 'simulation';

  constructor(persistence: SetupPersistenceAdapter, origin: 'live' | 'simulation' = 'live') {
    this.persistence = persistence;
    this.origin = origin;
  }

  getState = (): SetupStoreState => this.state;

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

  private setState(patch: Partial<SetupStoreState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private start(): void {
    this.started = true;
    marketDataStore.connectConsumer();
    analysisStore.connectConsumer();

    const restored: Record<string, GeneratedSetup> = {};
    if (SETUP_GENERATION_ENABLED) {
      for (const setup of this.persistence.load()) {
        if (setup.origin === this.origin) restored[setup.id] = setup;
      }
    }
    this.state = { setups: restored, resolutions: {}, lastEvaluatedAt: null, recalibrating: !SETUP_GENERATION_ENABLED };

    this.unsubscribeMarketData = marketDataStore.subscribe(() => {
      this.dirty = true;
    });
    this.unsubscribeAnalysis = analysisStore.subscribe(() => {
      this.dirty = true;
    });

    this.recompute();
    this.recomputeTimer = setInterval(() => {
      if (this.dirty) this.recompute();
    }, RECOMPUTE_INTERVAL_MS);
  }

  private stop(): void {
    this.started = false;
    this.unsubscribeMarketData?.();
    this.unsubscribeMarketData = null;
    this.unsubscribeAnalysis?.();
    this.unsubscribeAnalysis = null;
    if (this.recomputeTimer) clearInterval(this.recomputeTimer);
    this.recomputeTimer = null;
    marketDataStore.disconnectConsumer();
    analysisStore.disconnectConsumer();
  }

  private recompute(): void {
    this.dirty = false;
    const now = Date.now();

    if (!SETUP_GENERATION_ENABLED) {
      // Intelligence-engine rebuild in progress — market data/analysis/scanner keep running via the
      // subscriptions above, only setup publication is paused. See src/intelligence/generationStatus.ts.
      this.setState({ setups: {}, resolutions: {}, lastEvaluatedAt: now, recalibrating: true });
      return;
    }

    const { universe, bySymbol: marketBySymbol } = marketDataStore.getState();
    const analysisBySymbol = analysisStore.getState().bySymbol;
    const btcAnalysis = analysisBySymbol.BTCUSDT ?? null;
    const ethAnalysis = analysisBySymbol.ETHUSDT ?? null;
    const universeSymbols = new Set(universe.map((s) => s.symbol));
    const breadthBullishSharePct = computeBreadthBullishSharePct(analysisBySymbol);

    const existingBySymbol = new Map<string, GeneratedSetup[]>();
    for (const setup of Object.values(this.state.setups)) {
      const list = existingBySymbol.get(setup.symbol) ?? [];
      list.push(setup);
      existingBySymbol.set(setup.symbol, list);
    }

    const nextSetups: Record<string, GeneratedSetup> = { ...this.state.setups };

    for (const { symbol } of universe) {
      const analysis = analysisBySymbol[symbol];
      const marketData = marketBySymbol[symbol];
      if (!analysis || !marketData?.ticker) continue;
      const price = marketData.ticker.lastPrice;
      const existingForSymbol = existingBySymbol.get(symbol) ?? [];
      const priceIsStale = isStale(marketData.updatedAt, now, STALE_AFTER_MS);

      const { setups: updated } = orchestrateSymbolSetup({
        symbol,
        price,
        markPrice: marketData.markPrice?.markPrice ?? null,
        analysis,
        candles: marketData.candles,
        btcAnalysis,
        ethAnalysis,
        breadthBullishSharePct,
        recentLiquidations: marketData.recentLiquidations,
        longShortRatio: marketData.longShortRatio ?? null,
        now,
        existingForSymbol,
        origin: this.origin,
        priceIsStale,
      });
      for (const setup of updated) nextSetups[setup.id] = setup;
    }

    // Symbols that fell out of the dynamic top-50 no longer get fresh analysis —
    // only apply the age-based expiry check to their still-open setups.
    for (const [symbol, setups] of existingBySymbol) {
      if (universeSymbols.has(symbol)) continue;
      const lastKnownPrice = marketBySymbol[symbol]?.ticker?.lastPrice ?? null;
      for (const setup of setups) {
        const expired = expireVanishedUniverseSetup(setup, now, lastKnownPrice);
        if (expired) nextSetups[expired.id] = expired;
      }
    }

    this.setState({ setups: nextSetups, resolutions: {}, lastEvaluatedAt: now, recalibrating: false });
    this.persistAll();
  }

  private persistAll(): void {
    const others = this.persistence.load().filter((s) => s.origin !== this.origin);
    this.persistence.save([...others, ...Object.values(this.state.setups)]);
  }

  /** Dev/test only: wipes this store's in-memory and persisted state (only records of its own origin). */
  reset(): void {
    this.state = { setups: {}, resolutions: {}, lastEvaluatedAt: null, recalibrating: !SETUP_GENERATION_ENABLED };
    const others = this.persistence.load().filter((s) => s.origin !== this.origin);
    this.persistence.save(others);
    this.listeners.forEach((listener) => listener());
  }
}

export const setupStore = new SetupStore(localStorageSetupPersistence, 'live');
