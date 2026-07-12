import type { Candle } from '../../services/binance/types';
import type { SupportResistanceZone } from '../../analysis/engine/types';
import { deriveReadiness } from '../engine/readiness';
import { evidence } from '../engine/evidence';
import { SETUP_RULES } from '../engine/rules';
import type { SetupCondition, SetupDirection, SetupEvidence, SetupLevel } from '../engine/types';
import { applyAtrBuffer } from '../levels/atrBuffer';
import { buildAtrTarget, buildMeasuredMoveTarget } from '../levels/targets';
import { formatUsdPrice } from '../../utils/format';
import { isFinalCandle, type FamilyDefinition, type FamilyEvaluationInput, type FamilyResult } from './shared';

const FAMILY_ID = 'failed_breakout_reversal' as const;

/**
 * The analysis engine only exposes "failed_breakout" (a rejected upside
 * break). This family locally checks the symmetric downside case — a
 * rejected breakdown that reclaims support — using the same two-candle
 * pattern, so LONG and SHORT stay symmetric without duplicating the
 * analysis engine's zone-detection logic.
 */
function priorCandleBrokeBelow(candles1h: Candle[], supportZone: SupportResistanceZone): boolean {
  if (candles1h.length < 2) return false;
  return candles1h[candles1h.length - 2].close < supportZone.price;
}

function evaluateDirection(input: FamilyEvaluationInput, direction: SetupDirection): FamilyResult | null {
  const { analysis, price, candles1h } = input;
  const isLong = direction === 'LONG';
  const tf1h = analysis.timeframes['1h'];
  if (!tf1h || !tf1h.trend.sufficientData || !tf1h.volatility.sufficientData) return null;

  const atr = tf1h.volatility.atr14.value;
  if (atr === null || atr <= 0) return null;

  const zone = isLong ? tf1h.structure.nearestSupport : tf1h.structure.nearestResistance;
  if (!zone) return null;

  const patternDetected = isLong ? priorCandleBrokeBelow(candles1h, zone) : tf1h.structure.signal === 'failed_breakout';

  const contextConditions: SetupCondition[] = [
    {
      key: 'pattern_detected',
      label: isLong ? 'Recente mislukte breakdown' : 'Recente mislukte breakout',
      met: patternDetected,
      detail: patternDetected
        ? `Prijs brak recent door de ${isLong ? 'support' : 'resistance'}-zone rond ${formatUsdPrice(zone.price)} en probeert terug te keren.`
        : 'Geen recente mislukte uitbraak gevonden.',
    },
    {
      key: 'momentum_not_confirming_break',
      label: 'Momentum bevestigt de oorspronkelijke uitbraak niet',
      met: tf1h.momentum.classification !== (isLong ? 'weakening' : 'strengthening'),
      detail: `Momentum-classificatie: ${tf1h.momentum.classification}.`,
    },
  ];

  if (!contextConditions.every((c) => c.met)) return null;

  const rejectionBuffer = atr * SETUP_RULES.atr.rejectionConfirmationMult;
  const rejectionPrice = isLong ? zone.price + rejectionBuffer : zone.price - rejectionBuffer;
  const cleanRejection = isLong ? price >= rejectionPrice : price <= rejectionPrice;
  const candleClosed = isFinalCandle(candles1h);
  const volumeNotWeak = analysis.volume.classification !== 'low';

  const confirmationConditions: SetupCondition[] = [
    {
      key: 'clean_rejection',
      label: isLong ? 'Duidelijke terugkeer boven support' : 'Duidelijke terugkeer onder resistance',
      met: cleanRejection && candleClosed,
      detail: cleanRejection
        ? candleClosed
          ? 'Laatste 1H-candle bevestigt een schone terugkeer met voldoende marge.'
          : 'Prijs staat al voorbij de bevestigingsmarge, maar de candle is nog niet gesloten.'
        : 'Nog geen schone terugkeer met voldoende marge.',
    },
    { key: 'volume', label: 'Voldoende deelname', met: volumeNotWeak, detail: `Volume-classificatie: ${analysis.volume.classification}.` },
  ];

  const readiness = deriveReadiness(contextConditions, confirmationConditions, cleanRejection);
  if (readiness === 'none') return null;

  const invalidationPrice = applyAtrBuffer(zone.price, atr, SETUP_RULES.atr.invalidationBufferMult, isLong ? 'SHORT' : 'LONG');
  const trigger: SetupLevel = {
    price: rejectionPrice,
    timeframe: '1h',
    method: `${SETUP_RULES.atr.rejectionConfirmationMult}x ATR(14) voorbij de geteste zone`,
    explanation: `Bevestiging dat de eerdere ${isLong ? 'breakdown' : 'breakout'} een valse beweging was.`,
  };
  const invalidation: SetupLevel = {
    price: invalidationPrice,
    timeframe: '1h',
    method: `${SETUP_RULES.atr.invalidationBufferMult}x ATR(14) voorbij de zone, in de oorspronkelijke uitbraakrichting`,
    explanation: 'Een nieuwe, overtuigende beweging in de oorspronkelijke uitbraakrichting betekent dat de reversal-thesis niet klopt.',
  };

  const opposingZone = isLong ? tf1h.structure.nearestResistance : tf1h.structure.nearestSupport;
  const targets = [
    opposingZone
      ? buildMeasuredMoveTarget(price, zone.price, opposingZone.price, direction, invalidationPrice, '1h')
      : buildAtrTarget(price, atr, SETUP_RULES.atr.targetFarMult, direction, invalidationPrice, '1h'),
    buildAtrTarget(price, atr, SETUP_RULES.atr.targetNearMult, direction, invalidationPrice, '1h'),
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  const supporting: SetupEvidence[] = [
    evidence('market_structure', isLong ? 'Mislukte breakdown' : 'Mislukte breakout', `Zone rond ${formatUsdPrice(zone.price)} hield stand na een test.`),
    volumeNotWeak ? evidence('volume', 'Voldoende deelname', `Volume-classificatie: ${analysis.volume.classification}.`) : null,
  ].filter((e): e is SetupEvidence => e !== null);

  const opposing: SetupEvidence[] = [];
  if (tf1h.volatility.classification === 'extreme') {
    opposing.push(evidence('volatility', 'Extreme volatility', 'Grotere kans op nog een valse beweging in extreme volatility.'));
  }

  return {
    direction,
    family: FAMILY_ID,
    readiness,
    trigger,
    invalidation,
    entryZone: { low: Math.min(price, rejectionPrice), high: Math.max(price, rejectionPrice) },
    targets,
    supporting,
    opposing,
    missingData: [],
    atr,
  };
}

export const failedBreakoutReversal: FamilyDefinition = {
  id: FAMILY_ID,
  label: 'Failed breakout / reversal',
  documentation:
    'SHORT: analysis engine detecteert een failed_breakout (vorige 1H-candle sloot boven resistance, huidige weer terug eronder). LONG (symmetrisch, lokaal bepaald): vorige 1H-candle sloot onder support, prijs probeert terug te keren. Confirmation: schone terugkeer met een ATR-marge, voldoende deelname (volume niet low).',
  evaluate: (input) => {
    const results = [evaluateDirection(input, 'LONG'), evaluateDirection(input, 'SHORT')].filter(
      (r): r is FamilyResult => r !== null,
    );
    return results.length ? results : null;
  },
};
