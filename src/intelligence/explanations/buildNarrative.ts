import type { EvidenceLayers } from '../evidence/types';
import type { MarketRegimeResult } from '../regime/types';
import type { SignalStrength, ThesisDirection } from '../thesis/types';

const REGIME_LABEL: Record<string, string> = {
  strong_uptrend: 'a strong uptrend',
  weak_uptrend: 'a weak/early uptrend',
  strong_downtrend: 'a strong downtrend',
  weak_downtrend: 'a weak/early downtrend',
  range: 'a range-bound market',
  compression: 'a compressing range',
  expansion: 'a range expanding after compression',
  transition: 'a mid-transition market',
  chaotic: 'a chaotic, unreadable market',
  insufficient_data: 'a market with insufficient history to read',
};

/**
 * Composes the coherent written trade thesis the spec requires — every
 * sentence traces back to a specific evidence category's conclusion, never
 * an unexplained verdict. Used only for a VALID thesis; NO THESIS rejections
 * carry their own `detail` string instead (see decisionFlow.ts).
 */
export function buildThesisNarrative(params: {
  symbol: string;
  direction: ThesisDirection;
  regime: MarketRegimeResult;
  layers: EvidenceLayers;
  signalStrength: SignalStrength;
  contextAdjustments: string[];
}): string {
  const { symbol, direction, regime, layers, signalStrength, contextAdjustments } = params;
  const directionWord = direction === 'LONG' ? 'long' : 'short';
  const sentences: string[] = [];

  sentences.push(`${symbol} is in ${REGIME_LABEL[regime.regime] ?? regime.regime} (${regime.reasoning[0] ?? ''})`.trim() + '.');

  const structure = layers.layerA.higherTimeframeStructure;
  if (structure.supporting[0]) sentences.push(`Higher-timeframe structure: ${structure.supporting[0].description}`);

  const entryLocation = layers.layerA.entryLocationQuality[direction];
  if (entryLocation.supporting[0]) sentences.push(`Entry location: ${entryLocation.supporting[0].description}`);

  const layerB = [layers.layerB.trend, layers.layerB.momentum, layers.layerB.volume];
  const agreeing = layerB.filter((c) => c.conclusion.includes(direction === 'LONG' ? 'bullish' : 'bearish'));
  sentences.push(
    `${agreeing.length} of 3 directional-confirmation categories (trend/momentum/volume) support a ${directionWord} bias.`,
  );

  if (contextAdjustments.length > 0) {
    sentences.push(`Context notes: ${contextAdjustments.join('; ')}.`);
  }

  sentences.push(`Signal strength: ${signalStrength}.`);
  sentences.push('This is a structural read of current evidence, not a trading signal or a guarantee.');

  return sentences.join(' ');
}
