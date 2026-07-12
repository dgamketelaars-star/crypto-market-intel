import { deriveReadiness } from '../engine/readiness';
import { evidence } from '../engine/evidence';
import { SETUP_RULES } from '../engine/rules';
import type { SetupCondition, SetupDirection, SetupEvidence, SetupLevel } from '../engine/types';
import { applyAtrBuffer } from '../levels/atrBuffer';
import { buildAtrTarget } from '../levels/targets';
import { isFinalCandle, type FamilyDefinition, type FamilyEvaluationInput, type FamilyResult } from './shared';

const FAMILY_ID = 'volatility_compression_breakout' as const;

/** Range edges from candles *before* the current one — otherwise the current
 * candle's own high/low would always be included, making a breakout of the
 * range mathematically undetectable (price can never close above a high
 * that already accounts for that same candle). */
function rangeEdges(candles1h: FamilyEvaluationInput['candles1h']): { high: number; low: number } | null {
  const priorCandles = candles1h.slice(0, -1);
  const window = priorCandles.slice(-SETUP_RULES.compressionLookback);
  if (window.length < SETUP_RULES.compressionLookback) return null;
  return {
    high: Math.max(...window.map((c) => c.high)),
    low: Math.min(...window.map((c) => c.low)),
  };
}

function evaluateDirection(input: FamilyEvaluationInput, direction: SetupDirection): FamilyResult | null {
  const { analysis, price, candles1h } = input;
  const isLong = direction === 'LONG';
  const tf1h = analysis.timeframes['1h'];
  if (!tf1h || !tf1h.trend.sufficientData || !tf1h.volatility.sufficientData) return null;

  const atr = tf1h.volatility.atr14.value;
  if (atr === null || atr <= 0) return null;

  const edges = rangeEdges(candles1h);
  if (!edges) return null;

  const compressionSeen = tf1h.structure.rangeCompression || tf1h.structure.signal === 'expansion_after_compression';
  const leanMatches = isLong ? tf1h.trend.emaAlignment === 'bullish' : tf1h.trend.emaAlignment === 'bearish';

  const contextConditions: SetupCondition[] = [
    {
      key: 'compression',
      label: 'Range compressie gedetecteerd',
      met: compressionSeen,
      detail: compressionSeen ? '1H ATR% is duidelijk lager dan de recente baseline.' : 'Geen range compressie gedetecteerd op 1H.',
    },
    {
      key: 'directional_lean',
      label: isLong ? 'EMA-uitlijning leunt bullish' : 'EMA-uitlijning leunt bearish',
      met: leanMatches,
      detail: `EMA-uitlijning op 1H: ${tf1h.trend.emaAlignment}.`,
    },
  ];

  if (!contextConditions.every((c) => c.met)) return null;

  const edgePrice = isLong ? edges.high : edges.low;
  const nearEdge = isLong ? price >= edgePrice - atr * 0.3 : price <= edgePrice + atr * 0.3;
  const brokeEdge = isLong ? price > edgePrice : price < edgePrice;
  const candleClosed = isFinalCandle(candles1h);
  const expansionConfirmed = tf1h.structure.signal === 'expansion_after_compression';

  const confirmationConditions: SetupCondition[] = [
    {
      key: 'expansion',
      label: 'Expansie na compressie bevestigd',
      met: expansionConfirmed && brokeEdge && candleClosed,
      detail: !brokeEdge
        ? 'Prijs heeft de rand van de compressie-range nog niet doorbroken.'
        : !expansionConfirmed
          ? 'Prijs staat voorbij de range, maar de expansie is nog niet structureel bevestigd.'
          : candleClosed
            ? 'Laatste 1H-candle bevestigt de expansie buiten de compressie-range.'
            : 'Expansie zichtbaar, maar de candle is nog niet gesloten.',
    },
  ];

  const readiness = deriveReadiness(contextConditions, confirmationConditions, nearEdge || brokeEdge);
  if (readiness === 'none') return null;

  const invalidationPrice = applyAtrBuffer(isLong ? edges.low : edges.high, atr, SETUP_RULES.atr.invalidationBufferMult, direction);
  const trigger: SetupLevel = {
    price: edgePrice,
    timeframe: '1h',
    method: `Rand van de ${SETUP_RULES.compressionLookback}-candle compressie-range (1H)`,
    explanation: `${isLong ? 'Bovenkant' : 'Onderkant'} van de recent samengetrokken range.`,
  };
  const invalidation: SetupLevel = {
    price: invalidationPrice,
    timeframe: '1h',
    method: `Tegenoverliggende rand van de range, met ${SETUP_RULES.atr.invalidationBufferMult}x ATR-marge`,
    explanation: 'Terugval door de hele range heen betekent dat de uitbraak faalde.',
  };

  const targets = [buildAtrTarget(price, atr, SETUP_RULES.atr.compressionTargetMult, direction, invalidationPrice, '1h')].filter(
    (t): t is NonNullable<typeof t> => t !== null,
  );

  const supporting: SetupEvidence[] = [
    evidence('volatility', 'Range compressie', 'ATR% was duidelijk lager dan de baseline voordat de expansie begon.'),
    evidence('trend', 'EMA-uitlijning', `EMA-uitlijning op 1H: ${tf1h.trend.emaAlignment}.`),
    expansionConfirmed ? evidence('market_structure', 'Expansie bevestigd', '1H structuur toont expansion_after_compression.') : null,
  ].filter((e): e is SetupEvidence => e !== null);

  const opposing: SetupEvidence[] = [];
  if (analysis.volume.classification === 'low') {
    opposing.push(evidence('volume', 'Lage deelname', 'Volume tijdens de expansie is nog laag — kans op een valse start.'));
  }

  return {
    direction,
    family: FAMILY_ID,
    readiness,
    trigger,
    invalidation,
    entryZone: { low: Math.min(edges.low, edges.high), high: Math.max(edges.low, edges.high) },
    targets,
    supporting,
    opposing,
    missingData: [],
    atr,
  };
}

export const volatilityCompressionBreakout: FamilyDefinition = {
  id: FAMILY_ID,
  label: 'Volatility compression breakout candidate',
  documentation:
    'Context: 1H range compressie gedetecteerd (ATR% duidelijk onder baseline) met een EMA-uitlijning die een richting suggereert. Confirmation: structurele expansie na compressie (expansion_after_compression) met een gesloten 1H-candle voorbij de rand van de samengetrokken range. Blijft meestal langer in de candidate-fase omdat de richting pas laat vastligt.',
  evaluate: (input) => {
    const results = [evaluateDirection(input, 'LONG'), evaluateDirection(input, 'SHORT')].filter(
      (r): r is FamilyResult => r !== null,
    );
    return results.length ? results : null;
  },
};
