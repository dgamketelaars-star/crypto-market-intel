import { deriveReadiness } from '../engine/readiness';
import { evidence } from '../engine/evidence';
import { SETUP_RULES } from '../engine/rules';
import type { SetupCondition, SetupDirection, SetupEvidence, SetupLevel } from '../engine/types';
import { applyAtrBuffer } from '../levels/atrBuffer';
import { buildAtrTarget } from '../levels/targets';
import { isFinalCandle, last, type FamilyDefinition, type FamilyEvaluationInput, type FamilyResult } from './shared';

const FAMILY_ID = 'momentum_divergence_reversal' as const;

function evaluateDirection(input: FamilyEvaluationInput, direction: SetupDirection): FamilyResult | null {
  const { analysis, price, candles1h } = input;
  const isLong = direction === 'LONG';
  const tf1h = analysis.timeframes['1h'];
  if (!tf1h || !tf1h.trend.sufficientData || !tf1h.momentum.sufficientData || !tf1h.volatility.sufficientData) return null;

  const atr = tf1h.volatility.atr14.value;
  if (atr === null || atr <= 0) return null;

  const expectedDivergence = isLong ? 'bullish_divergence' : 'bearish_divergence';
  const divergenceDetected =
    tf1h.momentum.classification === 'diverging' && tf1h.momentum.divergenceDirection === expectedDivergence;

  const priorTrendOk = isLong
    ? tf1h.trend.classification === 'downtrend' || tf1h.trend.classification === 'transition'
    : tf1h.trend.classification === 'uptrend' || tf1h.trend.classification === 'transition';

  const contextConditions: SetupCondition[] = [
    {
      key: 'divergence',
      label: isLong ? 'Bullish divergence' : 'Bearish divergence',
      met: divergenceDetected,
      detail: divergenceDetected
        ? `RSI en prijs bewegen tegengesteld op 1H (${tf1h.momentum.divergenceDirection}).`
        : 'Geen momentum-divergence gedetecteerd op 1H.',
    },
    {
      key: 'prior_trend',
      label: 'Voorafgaande trend past bij een reversal',
      met: priorTrendOk,
      detail: `1H trend was ${tf1h.trend.classification} — een reversal veronderstelt een voorafgaande tegengestelde beweging.`,
    },
  ];

  if (!contextConditions.every((c) => c.met)) return null;

  const lastCandle = last(candles1h);
  const confirmingCandle = lastCandle ? (isLong ? lastCandle.close > lastCandle.open : lastCandle.close < lastCandle.open) : false;
  const candleClosed = isFinalCandle(candles1h);
  const macdTurning = tf1h.momentum.macdHistogramDirection === (isLong ? 'rising' : 'falling');

  const confirmationConditions: SetupCondition[] = [
    {
      key: 'confirming_candle',
      label: isLong ? 'Bevestigende bullish candle' : 'Bevestigende bearish candle',
      met: confirmingCandle && candleClosed,
      detail: confirmingCandle
        ? candleClosed
          ? 'Laatste 1H-candle sluit in de richting van de reversal.'
          : 'De huidige candle wijst op een reversal, maar is nog niet gesloten.'
        : 'Nog geen candle die de reversal-richting bevestigt.',
    },
    {
      key: 'macd_turning',
      label: 'MACD-histogram draait mee',
      met: macdTurning,
      detail: `MACD-histogramrichting: ${tf1h.momentum.macdHistogramDirection}.`,
    },
  ];

  const readiness = deriveReadiness(contextConditions, confirmationConditions, confirmingCandle);
  if (readiness === 'none') return null;

  const zone = isLong ? tf1h.structure.nearestResistance : tf1h.structure.nearestSupport;
  const triggerPrice = zone?.price ?? (isLong ? price + atr * 0.5 : price - atr * 0.5);
  const trigger: SetupLevel = {
    price: triggerPrice,
    timeframe: '1h',
    method: zone ? 'Doorbraak van de eerstvolgende structuurzone' : `0.5x ATR(14) voorbij de huidige prijs`,
    explanation: 'Bevestiging dat de divergence daadwerkelijk in een koerswending resulteert.',
  };

  const invalidationPrice = applyAtrBuffer(price, atr, SETUP_RULES.atr.invalidationBufferMult * 2, direction);
  const invalidation: SetupLevel = {
    price: invalidationPrice,
    timeframe: '1h',
    method: `${SETUP_RULES.atr.invalidationBufferMult * 2}x ATR(14) voorbij de huidige prijs, in de oorspronkelijke richting`,
    explanation: 'Een nieuwe extreme in de oorspronkelijke richting betekent dat de divergence niet tot een reversal leidde.',
  };

  const targets = [
    buildAtrTarget(price, atr, SETUP_RULES.atr.targetNearMult, direction, invalidationPrice, '1h'),
    buildAtrTarget(price, atr, SETUP_RULES.atr.targetFarMult, direction, invalidationPrice, '1h'),
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  const supporting: SetupEvidence[] = [
    evidence('momentum', isLong ? 'Bullish divergence' : 'Bearish divergence', 'RSI en prijs bewegen tegengesteld — momentum bevestigt de huidige prijsrichting niet meer.'),
    macdTurning ? evidence('momentum', 'MACD draait mee', `MACD-histogram: ${tf1h.momentum.macdHistogramDirection}.`) : null,
  ].filter((e): e is SetupEvidence => e !== null);

  const opposing: SetupEvidence[] = [];
  if (tf1h.volatility.classification === 'extreme') {
    opposing.push(evidence('volatility', 'Extreme volatility', 'Reversal-patronen zijn minder betrouwbaar bij extreme volatility.'));
  }
  if (analysis.volume.classification === 'low') {
    opposing.push(evidence('volume', 'Lage deelname', 'Weinig volume ondersteunt de reversal nog niet.'));
  }

  return {
    direction,
    family: FAMILY_ID,
    readiness,
    trigger,
    invalidation,
    entryZone: null,
    targets,
    supporting,
    opposing,
    missingData: [],
    atr,
  };
}

export const momentumDivergenceReversal: FamilyDefinition = {
  id: FAMILY_ID,
  label: 'Momentum divergence reversal',
  documentation:
    'Context: 1H momentum-classificatie is diverging in de verwachte richting (bullish_divergence voor LONG, bearish_divergence voor SHORT), voorafgaande trend past bij een reversal (downtrend/transition voor LONG, uptrend/transition voor SHORT). Confirmation: een 1H-candle sluit in de reversal-richting en het MACD-histogram draait mee.',
  evaluate: (input) => {
    const results = [evaluateDirection(input, 'LONG'), evaluateDirection(input, 'SHORT')].filter(
      (r): r is FamilyResult => r !== null,
    );
    return results.length ? results : null;
  },
};
