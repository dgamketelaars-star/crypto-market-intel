import { marketDataStore } from '../../../store/marketDataStore';
import { isStale, STALE_AFTER_MS } from '../../../utils/freshness';
import { expireVanishedSystemCSetup, type SystemCSetupState } from '../lifecycle/systemCLifecycle';
import { orchestrateSystemCSymbol } from '../orchestrateSystemCSymbol';
import { systemCPersistence } from '../persistence/systemCPersistence';

const RECOMPUTE_INTERVAL_MS = 5_000;
const TEARDOWN_GRACE_MS = 300;

export interface SystemCStoreState {
  setups: Record<string, SystemCSetupState>;
  lastEvaluatedAt: number | null;
}

type Listener = () => void;

/**
 * Live store for System C. Reads only raw candles from marketDataStore —
 * never touches analysisStore, setupStore (System A), or anything under
 * src/comparator/open-source-strategy/ (System B).
 */
export class SystemCStore {
  private state: SystemCStoreState = { setups: {}, lastEvaluatedAt: null };
  private listeners = new Set<Listener>();
  private consumerCount = 0;
  private teardownTimer: ReturnType<typeof setTimeout> | null = null;
  private recomputeTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeMarketData: (() => void) | null = null;
  private started = false;
  private dirty = true;

  getState = (): SystemCStoreState => this.state;

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

  private setState(patch: Partial<SystemCStoreState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private start(): void {
    this.started = true;
    marketDataStore.connectConsumer();

    const restored: Record<string, SystemCSetupState> = {};
    for (const setup of systemCPersistence.load()) restored[setup.id] = setup;
    this.state = { setups: restored, lastEvaluatedAt: null };

    this.unsubscribeMarketData = marketDataStore.subscribe(() => {
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
    if (this.recomputeTimer) clearInterval(this.recomputeTimer);
    this.recomputeTimer = null;
    marketDataStore.disconnectConsumer();
  }

  private recompute(): void {
    this.dirty = false;
    const now = Date.now();
    const { universe, bySymbol } = marketDataStore.getState();
    const universeSymbols = new Set(universe.map((s) => s.symbol));

    const existingBySymbol = new Map<string, SystemCSetupState>();
    for (const setup of Object.values(this.state.setups)) {
      if (setup.status === 'entry_zone_now' || setup.status === 'active') existingBySymbol.set(setup.symbol, setup);
    }

    const nextSetups: Record<string, SystemCSetupState> = { ...this.state.setups };

    for (const { symbol } of universe) {
      const marketData = bySymbol[symbol];
      if (!marketData?.ticker) continue;
      const candles1h = marketData.candles['1h'] ?? [];
      const priceIsStale = isStale(marketData.updatedAt, now, STALE_AFTER_MS);
      if (priceIsStale) continue;

      const { setup } = orchestrateSystemCSymbol({
        symbol,
        price: marketData.ticker.lastPrice,
        candles1h,
        now,
        existing: existingBySymbol.get(symbol) ?? null,
        origin: 'live',
      });
      if (setup) nextSetups[setup.id] = setup;
    }

    for (const [symbol, setup] of existingBySymbol) {
      if (universeSymbols.has(symbol)) continue;
      const lastKnownPrice = bySymbol[symbol]?.ticker?.lastPrice ?? null;
      const expired = expireVanishedSystemCSetup(setup, now, lastKnownPrice);
      if (expired) nextSetups[expired.id] = expired;
    }

    this.setState({ setups: nextSetups, lastEvaluatedAt: now });
    systemCPersistence.save(Object.values(nextSetups));
  }

  reset(): void {
    this.state = { setups: {}, lastEvaluatedAt: null };
    systemCPersistence.clear();
    this.listeners.forEach((listener) => listener());
  }
}

export const systemCStore = new SystemCStore();
