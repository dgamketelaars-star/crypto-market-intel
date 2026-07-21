/** Raw Binance market data shape shared by both phase prompts (see phase1Prompt.ts, phase2Prompt.ts). */
export interface CandleLike {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RawMarketSnapshot {
  symbol: string;
  price: number;
  candles1h: CandleLike[];
  candles4h: CandleLike[];
  fundingRatePct: number | null;
  /** Single latest reading, not a trend — no OI history is stored, so we don't fabricate a direction from one point. */
  openInterestValue: number | null;
  longShortRatio: number | null;
  recentLiquidationCount: number;
}

/** Compact CSV-like formatting to control token usage — full OHLCV is needed for genuine structure/S-R reasoning, so this trims precision and row count rather than dropping columns. */
export function formatCandles(label: string, candles: CandleLike[]): string {
  const rows = candles.map((c) => `${new Date(c.openTime).toISOString().slice(0, 16)},${c.open.toFixed(4)},${c.high.toFixed(4)},${c.low.toFixed(4)},${c.close.toFixed(4)},${c.volume.toFixed(0)}`);
  return `${label} (tijd,open,high,low,close,volume):\n${rows.join('\n')}`;
}

export function formatMarketContext(market: RawMarketSnapshot): string {
  const parts: string[] = [];
  parts.push(`# Analyse-opdracht: ${market.symbol}`);
  parts.push(`Huidige prijs: ${market.price}`);
  if (market.fundingRatePct != null) parts.push(`Funding rate: ${market.fundingRatePct.toFixed(4)}%`);
  if (market.openInterestValue != null) parts.push(`Open interest (huidige waarde, geen trend beschikbaar): ${market.openInterestValue}`);
  if (market.longShortRatio != null) parts.push(`Long/short ratio: ${market.longShortRatio.toFixed(3)}`);
  parts.push(`Recente liquidaties (rolling buffer): ${market.recentLiquidationCount}`);
  parts.push('');
  parts.push(formatCandles('4h candles', market.candles4h));
  parts.push('');
  parts.push(formatCandles('1h candles', market.candles1h));
  return parts.join('\n');
}
