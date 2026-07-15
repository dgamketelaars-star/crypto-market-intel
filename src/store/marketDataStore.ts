import {
  allForceOrderStreamName,
  klineStreamName,
  markPriceStreamName,
  tickerStreamName,
} from '../services/binance/endpoints';
import {
  normalizeCandleStream,
  normalizeFundingStream,
  normalizeLiquidationStream,
  normalizeMarkPriceStream,
  normalizeTickerStream,
} from '../services/binance/normalizers';
import {
  fetchExchangeInfo,
  fetchKlines,
  fetchOpenInterest,
  fetchPremiumIndexAll,
  fetchTicker24hrAll,
  fetchTopLongShortAccountRatio,
} from '../services/binance/rest';
import type {
  Candle,
  CandleInterval,
  ConnectionState,
  FundingData,
  FuturesSymbol,
  LiquidationEvent,
  LongShortRatioData,
  MarkPriceData,
  OpenInterestData,
  TickerData,
} from '../services/binance/types';
import { BinanceMarketStream } from '../services/binance/websocket';
import { mapWithConcurrency } from '../utils/concurrency';
import { OFFLINE_AFTER_MS, STALE_AFTER_MS } from '../utils/freshness';

export const CANDLE_INTERVALS: CandleInterval[] = ['15m', '1h', '4h', '1d'];
export const TOP_UNIVERSE_SIZE = 20;
export const ALWAYS_INCLUDED_SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

const UNIVERSE_REFRESH_MS = 5 * 60_000;
const OPEN_INTEREST_POLL_MS = 60_000;
const CONNECTION_CHECK_MS = 5_000;
/** 250 candles keeps EMA200 (analysis layer) properly converged instead of "insufficient data". */
const CANDLE_LIMIT = 250;
const FETCH_CONCURRENCY = 4;
/** Grace window so a React StrictMode dev double-mount doesn't tear down and reopen the socket. */
const TEARDOWN_GRACE_MS = 300;
/** Rolling per-symbol liquidation buffer — a "recent liquidation clustering" read needs recency, not full history. */
const LIQUIDATION_BUFFER_SIZE = 100;

export interface SymbolMarketData {
  symbol: string;
  ticker?: TickerData;
  markPrice?: MarkPriceData;
  funding?: FundingData;
  openInterest?: OpenInterestData;
  longShortRatio?: LongShortRatioData;
  /** Most recent forced liquidations for this symbol, oldest first, capped at LIQUIDATION_BUFFER_SIZE. */
  recentLiquidations: LiquidationEvent[];
  candles: Partial<Record<CandleInterval, Candle[]>>;
  updatedAt: number;
}

export interface MarketDataState {
  universe: FuturesSymbol[];
  bySymbol: Record<string, SymbolMarketData>;
  connection: ConnectionState;
  lastMessageAt: number | null;
  lastRestSyncAt: number | null;
  universeLoading: boolean;
  error: string | null;
}

type Listener = () => void;

function emptySymbolData(symbol: string): SymbolMarketData {
  return { symbol, candles: {}, recentLiquidations: [], updatedAt: 0 };
}

class MarketDataStore {
  private state: MarketDataState = {
    universe: [],
    bySymbol: {},
    connection: 'reconnecting',
    lastMessageAt: null,
    lastRestSyncAt: null,
    universeLoading: true,
    error: null,
  };

  private listeners = new Set<Listener>();
  private consumerCount = 0;
  private teardownTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  private universeTimer: ReturnType<typeof setInterval> | null = null;
  private openInterestTimer: ReturnType<typeof setInterval> | null = null;
  private connectionCheckTimer: ReturnType<typeof setInterval> | null = null;

  private wsStatus: 'open' | 'closed' | 'error' = 'closed';
  private disconnectedSince: number | null = Date.now();
  private openedAt: number | null = null;

  private readonly stream = new BinanceMarketStream(
    (streamName, data) => this.handleStreamMessage(streamName, data),
    (status) => this.handleWsStatus(status),
  );

  getState = (): MarketDataState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Reference-counted lifecycle: the underlying connection starts on the first
   * consumer and only tears down once the last one has been gone for a short
   * grace period — this survives React StrictMode's dev mount/unmount/remount. */
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

  private setState(patch: Partial<MarketDataState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private updateSymbol(symbol: string, patch: Partial<SymbolMarketData>): void {
    const prev = this.state.bySymbol[symbol] ?? emptySymbolData(symbol);
    const next: SymbolMarketData = { ...prev, ...patch, updatedAt: Date.now() };
    this.state = { ...this.state, bySymbol: { ...this.state.bySymbol, [symbol]: next } };
    this.listeners.forEach((listener) => listener());
  }

  private appendCandle(symbol: string, interval: CandleInterval, candle: Candle): void {
    const prev = this.state.bySymbol[symbol] ?? emptySymbolData(symbol);
    const existing = prev.candles[interval] ?? [];
    const last = existing[existing.length - 1];
    const nextCandles =
      last && last.openTime === candle.openTime
        ? [...existing.slice(0, -1), candle]
        : [...existing, candle].slice(-CANDLE_LIMIT);
    this.updateSymbol(symbol, { candles: { ...prev.candles, [interval]: nextCandles } });
  }

  /** The all-market stream covers every symbol on the exchange — only buffer liquidations for symbols we actually track. */
  private appendLiquidation(event: LiquidationEvent): void {
    const prev = this.state.bySymbol[event.symbol];
    if (!prev) return;
    const next = [...prev.recentLiquidations, event].slice(-LIQUIDATION_BUFFER_SIZE);
    this.updateSymbol(event.symbol, { recentLiquidations: next });
  }

  private start(): void {
    this.started = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineStatusChange);
      window.addEventListener('offline', this.handleOnlineStatusChange);
    }
    this.connectionCheckTimer = setInterval(() => this.recomputeConnectionState(), CONNECTION_CHECK_MS);
    void this.refreshUniverse();
    this.universeTimer = setInterval(() => void this.refreshUniverse(), UNIVERSE_REFRESH_MS);
  }

  private stop(): void {
    this.started = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineStatusChange);
      window.removeEventListener('offline', this.handleOnlineStatusChange);
    }
    if (this.universeTimer) clearInterval(this.universeTimer);
    if (this.openInterestTimer) clearInterval(this.openInterestTimer);
    if (this.connectionCheckTimer) clearInterval(this.connectionCheckTimer);
    this.universeTimer = null;
    this.openInterestTimer = null;
    this.connectionCheckTimer = null;
    this.stream.close();
  }

  private handleOnlineStatusChange = (): void => {
    if (typeof navigator !== 'undefined' && navigator.onLine) this.stream.forceReconnect();
    this.recomputeConnectionState();
  };

  private handleWsStatus(status: 'open' | 'closed' | 'error'): void {
    if (status === 'open') {
      this.disconnectedSince = null;
      this.openedAt = Date.now();
    } else {
      if (this.disconnectedSince === null) this.disconnectedSince = Date.now();
      this.openedAt = null;
    }
    this.wsStatus = status;
    this.recomputeConnectionState();
  }

  private recomputeConnectionState(): void {
    const now = Date.now();
    let next: ConnectionState;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      next = 'offline';
    } else if (this.wsStatus !== 'open') {
      const downFor = this.disconnectedSince ? now - this.disconnectedSince : 0;
      next = downFor > OFFLINE_AFTER_MS ? 'offline' : 'reconnecting';
    } else if (!this.state.lastMessageAt) {
      // Socket is open but hasn't produced its first message yet — give it a
      // brief warm-up window before treating the stream itself as delayed.
      const openFor = this.openedAt ? now - this.openedAt : 0;
      next = openFor > STALE_AFTER_MS ? 'delayed' : 'reconnecting';
    } else {
      next = now - this.state.lastMessageAt > STALE_AFTER_MS ? 'delayed' : 'live';
    }

    if (next !== this.state.connection) this.setState({ connection: next });
  }

  private handleStreamMessage(streamName: string, data: unknown): void {
    this.setState({ lastMessageAt: Date.now() });
    this.recomputeConnectionState();

    if (streamName === allForceOrderStreamName()) {
      try {
        this.appendLiquidation(normalizeLiquidationStream(data));
      } catch (error) {
        if (import.meta.env.DEV) console.error('[market-data-store] failed to process liquidation message', error);
      }
      return;
    }

    const at = streamName.indexOf('@');
    if (at === -1) return;
    const symbol = streamName.slice(0, at).toUpperCase();
    const kind = streamName.slice(at + 1);

    try {
      if (kind.startsWith('kline_')) {
        const interval = kind.slice('kline_'.length) as CandleInterval;
        this.appendCandle(symbol, interval, normalizeCandleStream(data));
      } else if (kind.startsWith('markPrice')) {
        this.updateSymbol(symbol, {
          markPrice: normalizeMarkPriceStream(data),
          funding: normalizeFundingStream(data),
        });
      } else if (kind === 'ticker') {
        this.updateSymbol(symbol, { ticker: normalizeTickerStream(data) });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[market-data-store] failed to process stream message', streamName, error);
      }
    }
  }

  private streamsForUniverse(universe: FuturesSymbol[]): string[] {
    const streams: string[] = [];
    for (const { symbol } of universe) {
      streams.push(tickerStreamName(symbol), markPriceStreamName(symbol));
      for (const interval of CANDLE_INTERVALS) streams.push(klineStreamName(symbol, interval));
    }
    return streams;
  }

  /** Ranks the eligible universe by 24h quote volume, keeps the top N, and
   * always folds in BTCUSDT/ETHUSDT for global market context. */
  private selectUniverse(candidates: FuturesSymbol[], tickers: TickerData[]): FuturesSymbol[] {
    const candidateMap = new Map(candidates.map((s) => [s.symbol, s]));
    const eligibleTickers = tickers.filter((t) => candidateMap.has(t.symbol));
    const ranked = [...eligibleTickers].sort((a, b) => b.quoteVolume - a.quoteVolume);
    const rankIndex = new Map(ranked.map((t, i) => [t.symbol, i]));

    const finalSet = new Set(ranked.slice(0, TOP_UNIVERSE_SIZE).map((t) => t.symbol));
    for (const forced of ALWAYS_INCLUDED_SYMBOLS) {
      if (candidateMap.has(forced)) finalSet.add(forced);
    }

    let finalSymbols = [...finalSet];
    if (finalSymbols.length > TOP_UNIVERSE_SIZE) {
      finalSymbols = finalSymbols
        .sort((a, b) => {
          const aForced = ALWAYS_INCLUDED_SYMBOLS.includes(a);
          const bForced = ALWAYS_INCLUDED_SYMBOLS.includes(b);
          if (aForced !== bForced) return aForced ? -1 : 1;
          return (rankIndex.get(a) ?? Infinity) - (rankIndex.get(b) ?? Infinity);
        })
        .slice(0, TOP_UNIVERSE_SIZE);
    }

    return finalSymbols.map((symbol) => candidateMap.get(symbol)).filter((s): s is FuturesSymbol => Boolean(s));
  }

  private async refreshUniverse(): Promise<void> {
    this.setState({ universeLoading: this.state.universe.length === 0, error: null });
    try {
      const [candidates, tickers, premium] = await Promise.all([
        fetchExchangeInfo(),
        fetchTicker24hrAll(),
        fetchPremiumIndexAll(),
      ]);

      const universe = this.selectUniverse(candidates, tickers);
      const previousSymbols = new Set(this.state.universe.map((s) => s.symbol));
      const newSymbols = universe.filter((s) => !previousSymbols.has(s.symbol));

      const tickerBySymbol = new Map(tickers.map((t) => [t.symbol, t]));
      const markBySymbol = new Map(premium.markPrices.map((m) => [m.symbol, m]));
      const fundingBySymbol = new Map(premium.funding.map((f) => [f.symbol, f]));

      for (const s of universe) {
        this.updateSymbol(s.symbol, {
          ticker: tickerBySymbol.get(s.symbol),
          markPrice: markBySymbol.get(s.symbol),
          funding: fundingBySymbol.get(s.symbol),
        });
      }

      this.setState({ universe, universeLoading: false, lastRestSyncAt: Date.now(), error: null });

      const desiredStreams = [...this.streamsForUniverse(universe), allForceOrderStreamName()];
      if (this.wsStatus === 'open') {
        this.stream.setStreams(desiredStreams);
      } else {
        this.stream.connect(desiredStreams);
      }

      if (newSymbols.length > 0) void this.loadCandleHistory(newSymbols);
      this.restartOpenInterestPolling(universe);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onbekende fout bij het ophalen van marktdata';
      if (import.meta.env.DEV) console.error('[market-data-store] universe refresh failed', error);
      // Keep the last known good universe/data on screen — only surface the error.
      this.setState({ universeLoading: false, error: message });
    }
  }

  private async loadCandleHistory(symbols: FuturesSymbol[]): Promise<void> {
    const jobs = symbols.flatMap((s) => CANDLE_INTERVALS.map((interval) => ({ symbol: s.symbol, interval })));
    await mapWithConcurrency(
      jobs,
      async ({ symbol, interval }) => {
        const candles = await fetchKlines(symbol, interval, CANDLE_LIMIT);
        const prevCandles = this.state.bySymbol[symbol]?.candles ?? {};
        this.updateSymbol(symbol, { candles: { ...prevCandles, [interval]: candles } });
      },
      FETCH_CONCURRENCY,
    );
  }

  /** Open interest and the long/short account ratio are both low-frequency positioning polls — sharing one timer avoids a second interval doing the same job at a near-identical cadence. */
  private restartOpenInterestPolling(universe: FuturesSymbol[]): void {
    if (this.openInterestTimer) clearInterval(this.openInterestTimer);
    const poll = () => {
      void mapWithConcurrency(
        universe,
        async ({ symbol }) => {
          const openInterest = await fetchOpenInterest(symbol);
          this.updateSymbol(symbol, { openInterest });
        },
        FETCH_CONCURRENCY,
      );
      void mapWithConcurrency(
        universe,
        async ({ symbol }) => {
          const longShortRatio = await fetchTopLongShortAccountRatio(symbol);
          if (longShortRatio) this.updateSymbol(symbol, { longShortRatio });
        },
        FETCH_CONCURRENCY,
      );
    };
    poll();
    this.openInterestTimer = setInterval(poll, OPEN_INTEREST_POLL_MS);
  }
}

export const marketDataStore = new MarketDataStore();
