import type { Candle } from '../../services/binance/types';
import type { VolatilityAnalysis } from '../../analysis/engine/types';
import { calculateBollingerSeries, isBollingerSqueeze } from '../../analysis/indicators/bollingerBands';
import { categoryEvidence, fact, insufficientData } from '../evidence/build';
import type { CategoryEvidence } from '../evidence/types';

/**
 * Volatility is a Layer C context category: it never creates a LONG/SHORT
 * bias — the conclusion is always 'neutral' when the read is usable. What
 * matters is *what's happening* (contraction/expansion/extreme), captured
 * in supporting facts for the thesis and trade-planning layers to act on
 * (tighten confirmation, cap strength, adjust stop/target sizing).
 */
export function evaluateVolatility(volatility: VolatilityAnalysis | undefined, candles: Candle[], sourceTimestamp: number): CategoryEvidence {
  if (!volatility || !volatility.sufficientData) {
    return insufficientData('volatility', volatility?.timeframe ?? null, sourceTimestamp, ['Insufficient candle history for ATR on this timeframe.']);
  }

  const closes = candles.map((c) => c.close);
  const bollinger = calculateBollingerSeries(closes);
  const widthSeries = bollinger.map((b) => b?.widthPct ?? null);
  const squeeze = isBollingerSqueeze(widthSeries);
  const latestWidth = widthSeries.at(-1);

  const supporting = [
    fact(`ATR classification: ${volatility.classification} (ATR% ${volatility.atrPct?.toFixed(2) ?? 'n/a'} vs baseline ${volatility.atrPctBaseline?.toFixed(2) ?? 'n/a'}).`, volatility.timeframe, sourceTimestamp),
  ];
  if (latestWidth !== null && latestWidth !== undefined) {
    supporting.push(fact(`Bollinger band width: ${(latestWidth * 100).toFixed(2)}% of price${squeeze ? ' — squeezing relative to recent history' : ''}.`, volatility.timeframe, sourceTimestamp));
  }

  const missingData = latestWidth === null || latestWidth === undefined ? ['Bollinger Bands unavailable (insufficient candle history).'] : [];

  return categoryEvidence({
    category: 'volatility',
    conclusion: 'neutral',
    supporting,
    missingData,
    timeframe: volatility.timeframe,
    sourceTimestamp,
  });
}

export function isExtremeVolatility(volatility: VolatilityAnalysis | undefined): boolean {
  return volatility?.classification === 'extreme';
}
