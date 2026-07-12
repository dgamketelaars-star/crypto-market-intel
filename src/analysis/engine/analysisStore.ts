import { marketDataStore } from '../../store/marketDataStore';
import { analyseUniverse } from './analyseUniverse';
import { historyBuffer } from './historyBuffer';
import type { SymbolAnalysis } from './types';

/** Recompute cadence — decoupled from render frequency and from how often
 * ticker/markPrice ticks arrive, so indicators aren't recalculated on every
 * store notification (which can fire several times per second). */
const RECOMPUTE_INTERVAL_MS = 3_000;
const TEARDOWN_GRACE_MS = 300;

export interface AnalysisState {
  bySymbol: Record<string, SymbolAnalysis>;
  calculatedAt: number | null;
}

type Listener = () => void;

class AnalysisStore {
  private state: AnalysisState = { bySymbol: {}, calculatedAt: null };
  private listeners = new Set<Listener>();
  private consumerCount = 0;
  private teardownTimer: ReturnType<typeof setTimeout> | null = null;
  private recomputeTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeMarketData: (() => void) | null = null;
  private started = false;
  private dirty = true;

  getState = (): AnalysisState => this.state;

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

  private start(): void {
    this.started = true;
    // Declare the dependency explicitly rather than assuming some other
    // component keeps the live data flowing.
    marketDataStore.connectConsumer();
    historyBuffer.ensureStarted();
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
    // historyBuffer intentionally keeps running — it holds accumulated OI/funding
    // history that would otherwise be lost on a brief teardown (e.g. StrictMode).
  }

  private recompute(): void {
    this.dirty = false;
    const { universe, bySymbol } = marketDataStore.getState();
    const calculatedAt = Date.now();
    const analysis = analyseUniverse(universe, bySymbol, calculatedAt);
    this.state = { bySymbol: analysis, calculatedAt };
    this.listeners.forEach((listener) => listener());
  }
}

export const analysisStore = new AnalysisStore();
