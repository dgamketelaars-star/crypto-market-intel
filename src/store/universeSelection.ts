import type { FuturesSymbol, TickerData } from '../services/binance/types';

/**
 * Pure, testable selection logic for the shared market universe (see
 * marketDataStore.ts, which owns the actual fetch/refresh cycle and is the
 * single source every system — A, B, C, D — reads from). Kept separate from
 * the store class so the selection rules themselves can be unit tested
 * without mocking timers, WebSockets, or REST calls.
 */

/** Symbol count in the shared universe. Was 20; raised to 50 so Systems A-D each get a broader, still-liquid scanning set. */
export const TOP_UNIVERSE_SIZE = 50;
export const ALWAYS_INCLUDED_SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

/**
 * Rank a symbol can fall to before it's dropped from an already-included
 * position, vs. the stricter rank a NEW symbol must clear to be admitted.
 * Without this, a symbol hovering right at rank 50 would flip in and out of
 * the universe on ordinary volume noise between refreshes. Own choice, kept
 * deliberately simple (a single buffer, no decay/smoothing model) per the
 * brief's "geen ingewikkeld systeem" instruction.
 */
const HYSTERESIS_BUFFER = 10;

/** Below this 24h quote volume (USDT), a symbol is excluded regardless of its relative rank — "top 50 of whatever is left" is not the goal if fewer than 50 pairs are genuinely liquid. */
const MIN_QUOTE_VOLUME_USDT = 5_000_000;

/** Best-effort "enough history to be useful" floor. Binance's onboardDate is the contract's actual listing date, so a symbol younger than this is still building up its candle history — the analysis layer already handles "insufficient_data" gracefully, so this is a courtesy filter, not a hard guarantee of exactly TOP_UNIVERSE_SIZE candles. */
const MIN_SYMBOL_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Defensive guard against leveraged-token-style base assets (3x/5x, UP/DOWN, BULL/BEAR). Binance USDⓈ-M Futures doesn't currently list these as perpetuals — isEligiblePerpetual's contractType/quoteAsset filter already excludes them in practice — but the brief asks for it explicitly, and this is cheap insurance if that ever changes. */
const LEVERAGED_BASE_ASSET_SUFFIXES = ['UP', 'DOWN', 'BULL', 'BEAR'];

function isLeveragedBaseAsset(baseAsset: string): boolean {
  return LEVERAGED_BASE_ASSET_SUFFIXES.some((suffix) => baseAsset.toUpperCase().endsWith(suffix));
}

/**
 * Additional eligibility on top of isEligiblePerpetual (TRADING status,
 * PERPETUAL contract, USDT quote — already applied when candidates are
 * fetched, see services/binance/rest.ts#fetchExchangeInfo). This layer adds
 * the criteria that need a reference "now" or are about defending against
 * unwanted instrument types rather than exchange-reported trading status.
 */
export function isEligibleForUniverse(symbol: FuturesSymbol, now: number): boolean {
  if (isLeveragedBaseAsset(symbol.baseAsset)) return false;
  if (symbol.onboardDate != null && now - symbol.onboardDate < MIN_SYMBOL_AGE_MS) return false;
  return true;
}

export interface SelectTopUniverseOptions {
  topSize?: number;
  hysteresisBuffer?: number;
  minQuoteVolumeUsdt?: number;
  now?: number;
}

/**
 * Ranks eligible, sufficiently-liquid candidates by 24h quote volume, keeps
 * the top N with hysteresis for symbols already in the universe, and always
 * folds in BTCUSDT/ETHUSDT (if they're eligible perpetuals at all) for
 * global market context regardless of where they rank.
 *
 * By design the result can hold slightly more than `topSize` symbols: a
 * hysteresis buffer that only ever admits (never evicts a strict top-N
 * member to make room) is what keeps rank-~50 symbols from flapping in and
 * out on ordinary volume noise. The trade-off is a universe that floats in
 * roughly [topSize, topSize + hysteresisBuffer + 2] rather than a fixed
 * count — a deliberately simple rule over a more precise but fiddlier one
 * that would need to evict incumbents to hold an exact size.
 */
export function selectTopUniverse(
  candidates: FuturesSymbol[],
  tickers: TickerData[],
  previousSymbols: Set<string>,
  options: SelectTopUniverseOptions = {},
): FuturesSymbol[] {
  const topSize = options.topSize ?? TOP_UNIVERSE_SIZE;
  const hysteresisBuffer = options.hysteresisBuffer ?? HYSTERESIS_BUFFER;
  const minQuoteVolumeUsdt = options.minQuoteVolumeUsdt ?? MIN_QUOTE_VOLUME_USDT;
  const now = options.now ?? Date.now();

  const candidateMap = new Map(candidates.map((s) => [s.symbol, s]));
  const eligibleSymbols = new Set(candidates.filter((s) => isEligibleForUniverse(s, now)).map((s) => s.symbol));

  const rankedByVolume = tickers
    .filter((t) => eligibleSymbols.has(t.symbol) && t.quoteVolume >= minQuoteVolumeUsdt)
    .sort((a, b) => b.quoteVolume - a.quoteVolume);
  const rankIndex = new Map(rankedByVolume.map((t, i) => [t.symbol, i]));

  const finalSet = new Set<string>();
  // Strict admission: only the true top N by current rank get newly added.
  for (const t of rankedByVolume.slice(0, topSize)) finalSet.add(t.symbol);
  // Hysteresis: an incumbent that's merely drifted out of the strict top N,
  // but is still within the buffer, keeps its place rather than churning —
  // this never evicts a strict top-N member, so the set can grow slightly.
  for (const symbol of previousSymbols) {
    const rank = rankIndex.get(symbol);
    if (rank != null && rank < topSize + hysteresisBuffer) finalSet.add(symbol);
  }
  for (const forced of ALWAYS_INCLUDED_SYMBOLS) {
    if (candidateMap.has(forced)) finalSet.add(forced);
  }

  const finalSymbols = [...finalSet].sort((a, b) => {
    const aForced = ALWAYS_INCLUDED_SYMBOLS.includes(a);
    const bForced = ALWAYS_INCLUDED_SYMBOLS.includes(b);
    if (aForced !== bForced) return aForced ? -1 : 1;
    return (rankIndex.get(a) ?? Infinity) - (rankIndex.get(b) ?? Infinity);
  });

  return finalSymbols.map((symbol) => candidateMap.get(symbol)).filter((s): s is FuturesSymbol => Boolean(s));
}
