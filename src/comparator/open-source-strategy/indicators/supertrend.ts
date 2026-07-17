/**
 * Supertrend indicator, ported faithfully from FSupertrendStrategy.py's
 * `supertrend()` method (see metadata/provenance.ts). Deliberately NOT
 * reusing src/analysis/indicators/atr.ts: the upstream strategy computes ATR
 * as a plain SMA of True Range (ta.SMA(TRANGE, period)), not Wilder's
 * smoothing — a different formula, kept isolated on purpose.
 */
export interface SupertrendCandle {
  high: number;
  low: number;
  close: number;
}

export type SupertrendDirection = 'up' | 'down';

export interface SupertrendPoint {
  /** null until `period` candles have accumulated, matching upstream's uninitialized 0.00 carry-forward window. */
  value: number | null;
  direction: SupertrendDirection | null;
}

function trueRangeSeries(candles: SupertrendCandle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });
}

/** Plain SMA of True Range — matches upstream's `ta.SMA(df["TR"], period)`, not Wilder's ATR. */
function smaAtrSeries(tr: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(tr.length).fill(null);
  for (let i = period - 1; i < tr.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += tr[j];
    result[i] = sum / period;
  }
  return result;
}

export function calculateSupertrendSeries(candles: SupertrendCandle[], multiplier: number, period: number): SupertrendPoint[] {
  const n = candles.length;
  const result: SupertrendPoint[] = new Array(n).fill(null).map(() => ({ value: null, direction: null }));
  if (n <= period) return result;

  const tr = trueRangeSeries(candles);
  const atr = smaAtrSeries(tr, period);

  const basicUb: number[] = new Array(n).fill(0);
  const basicLb: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = atr[i] ?? 0;
    basicUb[i] = (candles[i].high + candles[i].low) / 2 + multiplier * a;
    basicLb[i] = (candles[i].high + candles[i].low) / 2 - multiplier * a;
  }

  const finalUb: number[] = new Array(n).fill(0);
  const finalLb: number[] = new Array(n).fill(0);
  for (let i = period; i < n; i++) {
    finalUb[i] = basicUb[i] < finalUb[i - 1] || candles[i - 1].close > finalUb[i - 1] ? basicUb[i] : finalUb[i - 1];
    finalLb[i] = basicLb[i] > finalLb[i - 1] || candles[i - 1].close < finalLb[i - 1] ? basicLb[i] : finalLb[i - 1];
  }

  const st: number[] = new Array(n).fill(0);
  for (let i = period; i < n; i++) {
    const close = candles[i].close;
    if (st[i - 1] === finalUb[i - 1] && close <= finalUb[i]) st[i] = finalUb[i];
    else if (st[i - 1] === finalUb[i - 1] && close > finalUb[i]) st[i] = finalLb[i];
    else if (st[i - 1] === finalLb[i - 1] && close >= finalLb[i]) st[i] = finalLb[i];
    else if (st[i - 1] === finalLb[i - 1] && close < finalLb[i]) st[i] = finalUb[i];
    else st[i] = 0;

    if (st[i] > 0) {
      result[i] = { value: st[i], direction: close < st[i] ? 'down' : 'up' };
    }
  }

  return result;
}

export function latestSupertrend(candles: SupertrendCandle[], multiplier: number, period: number): SupertrendPoint {
  const series = calculateSupertrendSeries(candles, multiplier, period);
  return series[series.length - 1] ?? { value: null, direction: null };
}
