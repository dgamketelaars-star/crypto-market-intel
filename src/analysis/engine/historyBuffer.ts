import { marketDataStore } from '../../store/marketDataStore';

export interface OiSample {
  time: number;
  openInterest: number;
}

export interface FundingSample {
  time: number;
  fundingRate: number;
}

/** Keep slightly more than 24h so a 24h-ago sample is always available once the app has run that long. */
const MAX_AGE_MS = 25 * 60 * 60 * 1000;
/** Avoid pointless duplicate funding samples if the store fires faster than funding actually changes. */
const MIN_FUNDING_SAMPLE_GAP_MS = 60_000;

/**
 * A small, independent time-series buffer for open interest and funding.
 * It only *reads* marketDataStore's public subscribe/getState API — it does
 * not touch the Binance connection, REST, or WebSocket layers.
 */
class HistoryBuffer {
  private oi = new Map<string, OiSample[]>();
  private funding = new Map<string, FundingSample[]>();
  private lastSeenOiTime = new Map<string, number>();
  private lastSeenFundingTime = new Map<string, number>();
  private unsubscribe: (() => void) | null = null;
  private started = false;

  ensureStarted(): void {
    if (this.started) return;
    this.started = true;
    this.unsubscribe = marketDataStore.subscribe(() => this.ingest());
    this.ingest();
  }

  stop(): void {
    this.started = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  getOiHistory(symbol: string): OiSample[] {
    return this.oi.get(symbol) ?? [];
  }

  getFundingHistory(symbol: string): FundingSample[] {
    return this.funding.get(symbol) ?? [];
  }

  private ingest(): void {
    const { bySymbol } = marketDataStore.getState();
    for (const symbol of Object.keys(bySymbol)) {
      const data = bySymbol[symbol];

      if (data.openInterest) {
        const lastTime = this.lastSeenOiTime.get(symbol);
        if (lastTime !== data.openInterest.time) {
          this.lastSeenOiTime.set(symbol, data.openInterest.time);
          this.push(this.oi, symbol, { time: data.openInterest.time, openInterest: data.openInterest.openInterest });
        }
      }

      if (data.funding) {
        const lastTime = this.lastSeenFundingTime.get(symbol);
        if (lastTime === undefined || data.funding.time - lastTime >= MIN_FUNDING_SAMPLE_GAP_MS) {
          this.lastSeenFundingTime.set(symbol, data.funding.time);
          this.push(this.funding, symbol, { time: data.funding.time, fundingRate: data.funding.fundingRate });
        }
      }
    }
    this.prune();
  }

  private push<T extends { time: number }>(map: Map<string, T[]>, symbol: string, sample: T): void {
    const list = map.get(symbol) ?? [];
    list.push(sample);
    map.set(symbol, list);
  }

  private prune(): void {
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const [symbol, list] of this.oi) {
      if (list.length && list[0].time < cutoff) this.oi.set(symbol, list.filter((s) => s.time >= cutoff));
    }
    for (const [symbol, list] of this.funding) {
      if (list.length && list[0].time < cutoff) this.funding.set(symbol, list.filter((s) => s.time >= cutoff));
    }
  }
}

export const historyBuffer = new HistoryBuffer();
