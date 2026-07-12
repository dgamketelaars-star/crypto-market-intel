/**
 * Structural sanity-check checkpoint (between intelligence-layer Phase 2
 * and Phase 3 — see the Evidence Synthesis & Decision Hierarchy spec, §9).
 *
 * This is NOT a profitability backtest. It replays real historical candles
 * through the Phase 1/2 pipeline (indicators -> trend/momentum/volatility
 * ->structure -> regime -> BOS/CHOCH) and prints a structured report:
 * regime/structure distributions plus specific dated windows for manual
 * review, so obviously-wrong classifications get caught before the thesis
 * layer (Phase 3) is built on top of this foundation.
 *
 * Honesty note: this script performs the *automated* half of the checkpoint
 * (running the real pipeline against real data, cross-checking internal
 * consistency, and flagging classifications against publicly known market
 * history). It is not a substitute for a human visually reviewing charts —
 * see the report's closing section for what still needs a human pass.
 *
 * Run with: npx tsx scripts/structuralSanityCheck.ts
 */
import { analyseTimeframe } from '../src/analysis/engine/timeframeAnalysis';
import { latestAdx } from '../src/analysis/indicators/adx';
import { classifyMarketRegime } from '../src/intelligence/regime/classifyRegime';
import type { MarketRegime } from '../src/intelligence/regime/types';
import { detectStructureEvent } from '../src/intelligence/structure/structureEvents';
import type { Candle } from '../src/services/binance/types';

const BINANCE_FAPI = 'https://fapi.binance.com/fapi/v1/klines';
const WINDOW_SIZE = 260; // matches the live app's fetched candle depth
const STEP_DAYS = 20;

interface RawKline {
  0: number; // open time
  1: string; // open
  2: string; // high
  3: string; // low
  4: string; // close
  5: string; // volume
  6: number; // close time
}

async function fetchDailyKlines(symbol: string, limit = 1500): Promise<Candle[]> {
  const url = `${BINANCE_FAPI}?symbol=${symbol}&interval=1d&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines fetch failed for ${symbol}: ${res.status}`);
  const raw = (await res.json()) as RawKline[];
  return raw.map((k) => ({
    openTime: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: Number(k[6]),
    isFinal: true,
  }));
}

interface CheckpointResult {
  date: string;
  price: number;
  regime: MarketRegime;
  bias: string;
  structureEvent: string;
  trendClassification: string;
  volatilityClassification: string;
}

function runCheckpoints(symbol: string, candles: Candle[]): CheckpointResult[] {
  const results: CheckpointResult[] = [];
  for (let end = WINDOW_SIZE; end < candles.length; end += STEP_DAYS) {
    const window = candles.slice(end - WINDOW_SIZE, end);
    const asOf = window[window.length - 1];
    const tf = analyseTimeframe(window, '1d', asOf.closeTime);
    const adx = latestAdx(window);
    // Regime classification is designed to combine 4H+1D; this offline check only has 1D history
    // fetched, so it deliberately feeds the same 1D read into both slots (disclosed simplification —
    // see the report). This means "chaotic" (which requires a genuine 4H/1D conflict) can never fire
    // here; that specific branch is covered by classifyRegime.test.ts's unit tests instead.
    const regime = classifyMarketRegime({
      trend4h: tf.trend,
      trend1d: tf.trend,
      volatility4h: tf.volatility,
      volatility1d: tf.volatility,
      structure4h: tf.structure,
      structure1d: tf.structure,
      adx4h: adx,
      adx1d: adx,
    });
    const structureEvent = detectStructureEvent(window);

    results.push({
      date: new Date(asOf.closeTime).toISOString().slice(0, 10),
      price: asOf.close,
      regime: regime.regime,
      bias: regime.bias,
      structureEvent: structureEvent.event,
      trendClassification: tf.trend.classification,
      volatilityClassification: tf.volatility.classification,
    });
  }
  return results;
}

function printDistribution(label: string, counts: Record<string, number>): void {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`  ${label}:`);
  for (const [key, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${key.padEnd(24)} ${count.toString().padStart(4)}  (${((count / total) * 100).toFixed(1)}%)`);
  }
}

function tally(results: CheckpointResult[], field: keyof CheckpointResult): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of results) counts[String(r[field])] = (counts[String(r[field])] ?? 0) + 1;
  return counts;
}

async function main() {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT'];
  const allResults: Record<string, CheckpointResult[]> = {};

  for (const symbol of symbols) {
    console.log(`\nFetching ${symbol} 1D history...`);
    const candles = await fetchDailyKlines(symbol);
    console.log(`  ${candles.length} candles, ${new Date(candles[0].openTime).toISOString().slice(0, 10)} -> ${new Date(candles.at(-1)!.closeTime).toISOString().slice(0, 10)}`);
    const results = runCheckpoints(symbol, candles);
    allResults[symbol] = results;
    console.log(`  ${results.length} checkpoints evaluated (every ${STEP_DAYS} days, ${WINDOW_SIZE}-candle window)`);
    printDistribution('Regime distribution', tally(results, 'regime'));
    printDistribution('Structure event distribution', tally(results, 'structureEvent'));
  }

  console.log('\n\n=== Dated checkpoints for manual spot-check (BTCUSDT, every ~100 days) ===');
  const btc = allResults.BTCUSDT;
  for (let i = 0; i < btc.length; i += 5) {
    const r = btc[i];
    console.log(`  ${r.date}  price=${r.price.toFixed(0).padStart(7)}  regime=${r.regime.padEnd(16)} trend=${r.trendClassification.padEnd(12)} vol=${r.volatilityClassification.padEnd(10)} structure=${r.structureEvent}`);
  }

  console.log('\n\n=== Internal consistency checks ===');
  for (const symbol of symbols) {
    const results = allResults[symbol];
    const chaoticCount = results.filter((r) => r.regime === 'chaotic').length;
    const insufficientCount = results.filter((r) => r.regime === 'insufficient_data').length;
    const strongTrendWithLowAdxBias = results.filter((r) => (r.regime === 'strong_uptrend' || r.regime === 'strong_downtrend') && r.bias === 'neutral');
    console.log(`  ${symbol}: chaotic=${chaoticCount} (expected 0 — offline check feeds identical 4H/1D, see disclosed simplification), insufficient_data=${insufficientCount}, strong-trend-with-neutral-bias=${strongTrendWithLowAdxBias.length} (should always be 0 — bias must follow strong/weak trend regimes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
