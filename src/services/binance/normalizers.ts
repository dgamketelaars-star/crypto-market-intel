import type {
  Candle,
  FundingData,
  FuturesSymbol,
  LiquidationEvent,
  LongShortRatioData,
  MarkPriceData,
  OpenInterestData,
  TickerData,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Active USDⓈ-M perpetual USDT contracts — excludes delivery, inactive and non-USDT pairs. */
export function isEligiblePerpetual(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  return raw.status === 'TRADING' && raw.contractType === 'PERPETUAL' && raw.quoteAsset === 'USDT';
}

export function normalizeSymbol(raw: unknown): FuturesSymbol {
  if (!isRecord(raw) || typeof raw.symbol !== 'string') {
    throw new Error('Invalid exchangeInfo symbol payload');
  }
  return {
    symbol: raw.symbol,
    baseAsset: String(raw.baseAsset ?? ''),
    quoteAsset: String(raw.quoteAsset ?? ''),
    status: String(raw.status ?? ''),
    contractType: String(raw.contractType ?? ''),
    onboardDate: typeof raw.onboardDate === 'number' ? raw.onboardDate : undefined,
  };
}

export function normalizeTickerRest(raw: unknown): TickerData {
  if (!isRecord(raw) || typeof raw.symbol !== 'string') {
    throw new Error('Invalid 24hr ticker payload');
  }
  return {
    symbol: raw.symbol,
    lastPrice: Number(raw.lastPrice),
    priceChangePercent: Number(raw.priceChangePercent),
    quoteVolume: Number(raw.quoteVolume),
    time: Number(raw.closeTime),
  };
}

export function normalizeTickerStream(raw: unknown): TickerData {
  if (!isRecord(raw) || typeof raw.s !== 'string') {
    throw new Error('Invalid ticker stream payload');
  }
  return {
    symbol: raw.s,
    lastPrice: Number(raw.c),
    priceChangePercent: Number(raw.P),
    quoteVolume: Number(raw.q),
    time: Number(raw.E),
  };
}

export function normalizeMarkPriceRest(raw: unknown): MarkPriceData {
  if (!isRecord(raw) || typeof raw.symbol !== 'string') {
    throw new Error('Invalid premiumIndex payload');
  }
  return {
    symbol: raw.symbol,
    markPrice: Number(raw.markPrice),
    indexPrice: Number(raw.indexPrice),
    time: Number(raw.time),
  };
}

export function normalizeFundingRest(raw: unknown): FundingData {
  if (!isRecord(raw) || typeof raw.symbol !== 'string') {
    throw new Error('Invalid premiumIndex payload');
  }
  return {
    symbol: raw.symbol,
    fundingRate: Number(raw.lastFundingRate),
    nextFundingTime: Number(raw.nextFundingTime),
    time: Number(raw.time),
  };
}

export function normalizeMarkPriceStream(raw: unknown): MarkPriceData {
  if (!isRecord(raw) || typeof raw.s !== 'string') {
    throw new Error('Invalid markPrice stream payload');
  }
  return {
    symbol: raw.s,
    markPrice: Number(raw.p),
    indexPrice: Number(raw.i),
    time: Number(raw.E),
  };
}

export function normalizeFundingStream(raw: unknown): FundingData {
  if (!isRecord(raw) || typeof raw.s !== 'string') {
    throw new Error('Invalid markPrice stream payload');
  }
  return {
    symbol: raw.s,
    fundingRate: Number(raw.r),
    nextFundingTime: Number(raw.T),
    time: Number(raw.E),
  };
}

export function normalizeOpenInterestRest(raw: unknown): OpenInterestData {
  if (!isRecord(raw) || typeof raw.symbol !== 'string') {
    throw new Error('Invalid openInterest payload');
  }
  return {
    symbol: raw.symbol,
    openInterest: Number(raw.openInterest),
    time: Number(raw.time),
  };
}

export function normalizeCandleRest(raw: unknown): Candle {
  if (!Array.isArray(raw) || raw.length < 7) {
    throw new Error('Invalid kline row payload');
  }
  return {
    openTime: Number(raw[0]),
    open: Number(raw[1]),
    high: Number(raw[2]),
    low: Number(raw[3]),
    close: Number(raw[4]),
    volume: Number(raw[5]),
    closeTime: Number(raw[6]),
    isFinal: true,
  };
}

export function normalizeLiquidationStream(raw: unknown): LiquidationEvent {
  if (!isRecord(raw) || !isRecord(raw.o)) {
    throw new Error('Invalid forceOrder stream payload');
  }
  const o = raw.o;
  if (typeof o.s !== 'string') {
    throw new Error('Invalid forceOrder stream payload');
  }
  return {
    symbol: o.s,
    side: o.S === 'BUY' ? 'BUY' : 'SELL',
    price: Number(o.ap ?? o.p),
    quantity: Number(o.q),
    time: Number(o.T ?? raw.E),
  };
}

export function normalizeLongShortRatioRest(raw: unknown): LongShortRatioData {
  if (!isRecord(raw) || typeof raw.symbol !== 'string') {
    throw new Error('Invalid longShortRatio payload');
  }
  return {
    symbol: raw.symbol,
    longShortRatio: Number(raw.longShortRatio),
    longAccountPct: Number(raw.longAccount) * 100,
    shortAccountPct: Number(raw.shortAccount) * 100,
    time: Number(raw.timestamp),
  };
}

export function normalizeCandleStream(raw: unknown): Candle {
  if (!isRecord(raw) || !isRecord(raw.k)) {
    throw new Error('Invalid kline stream payload');
  }
  const k = raw.k;
  return {
    openTime: Number(k.t),
    open: Number(k.o),
    high: Number(k.h),
    low: Number(k.l),
    close: Number(k.c),
    volume: Number(k.v),
    closeTime: Number(k.T),
    isFinal: Boolean(k.x),
  };
}
