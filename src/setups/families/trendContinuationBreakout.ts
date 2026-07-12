import { formatUsdPrice } from '../../utils/format';
import { deriveReadiness } from '../engine/readiness';
import { evidence } from '../engine/evidence';
import { isVolumeConfirming, SETUP_RULES } from '../engine/rules';
import type { SetupCondition, SetupDirection, SetupEvidence, SetupLevel } from '../engine/types';
import { applyAtrBuffer, isWithinAtr } from '../levels/atrBuffer';
import { buildAtrTarget, buildMeasuredMoveTarget } from '../levels/targets';
import { isFinalCandle, resolveZone, type FamilyDefinition, type FamilyEvaluationInput, type FamilyResult } from './shared';

const FAMILY_ID = 'trend_continuation_breakout' as const;

function evaluateDirection(input: FamilyEvaluationInput, direction: SetupDirection): FamilyResult | null {
  const { analysis, price, candles1h } = input;
  const isLong = direction === 'LONG';
  const tf1h = analysis.timeframes['1h'];
  const tf4h = analysis.timeframes['4h'];
  const tf1d = analysis.timeframes['1d'];
  if (!tf1h || !tf1h.trend.sufficientData || !tf1h.volatility.sufficientData) return null;

  const atr = tf1h.volatility.atr14.value;
  if (atr === null || atr <= 0) return null;

  const zone = resolveZone(
    isLong ? tf1h.structure.nearestResistance : tf1h.structure.nearestSupport,
    candles1h,
    isLong ? 'resistance' : 'support',
  );
  if (!zone) return null;

  const missingData: SetupEvidence[] = [];

  const trend4hOk = tf4h
    ? isLong
      ? tf4h.trend.classification === 'uptrend' ||
        (tf4h.trend.classification === 'transition' && tf4h.trend.emaAlignment === 'bullish')
      : tf4h.trend.classification === 'downtrend' ||
        (tf4h.trend.classification === 'transition' && tf4h.trend.emaAlignment === 'bearish')
    : false;
  if (!tf4h) missingData.push(evidence('trend', '4H trend', 'Onvoldoende 4H-candles om de bredere trend te bepalen.'));

  let trend1dOk = true;
  if (tf1d && tf1d.trend.sufficientData) {
    trend1dOk = isLong ? tf1d.trend.classification !== 'downtrend' : tf1d.trend.classification !== 'uptrend';
  } else {
    missingData.push(evidence('trend', '1D trend', 'Onvoldoende 1D-candles — niet blokkerend, wel als open risico genoteerd.'));
  }

  const priceAboveEmas = isLong
    ? (tf1h.trend.priceVsEma20Pct ?? -1) > 0 && (tf1h.trend.priceVsEma50Pct ?? -1) > 0
    : (tf1h.trend.priceVsEma20Pct ?? 1) < 0 && (tf1h.trend.priceVsEma50Pct ?? 1) < 0;

  const emaAlignmentOk = isLong ? tf1h.trend.emaAlignment === 'bullish' : tf1h.trend.emaAlignment === 'bearish';

  const nearZone = isWithinAtr(price, zone.price, atr, SETUP_RULES.proximity.triggerProximityAtrMult);
  // Price vs. the resolved zone (not the analysis engine's single-tick signal),
  // so confirmation stays checkable for a few candles after the initial break —
  // by definition, a zone stops being "nearby resistance above price" the
  // moment price clears it, which would otherwise make the break undetectable
  // on any tick after the very first one.
  const zoneBuffer = 0.0015;
  const structureBreak = isLong ? price > zone.price * (1 + zoneBuffer) : price < zone.price * (1 - zoneBuffer);
  const approachingOrBreaking = structureBreak || nearZone;

  const contextConditions: SetupCondition[] = [
    {
      key: 'trend_4h',
      label: '4H trend',
      met: trend4hOk,
      detail: tf4h ? `4H trend is ${tf4h.trend.classification}.` : 'Onvoldoende 4H-data.',
    },
    {
      key: 'trend_1d',
      label: '1D trend niet tegengesteld',
      met: trend1dOk,
      detail: tf1d?.trend.sufficientData ? `1D trend is ${tf1d.trend.classification}.` : 'Onvoldoende 1D-data — niet blokkerend.',
    },
    {
      key: 'price_above_emas',
      label: 'Prijs t.o.v. EMA20/50 (1H)',
      met: priceAboveEmas,
      detail: `Prijs staat ${isLong ? 'boven' : 'onder'} zowel EMA20 als EMA50 op 1H.`,
    },
    {
      key: 'ema_alignment',
      label: 'EMA-uitlijning (1H)',
      met: emaAlignmentOk,
      detail: `EMA20 is ${isLong ? 'boven' : 'onder'} EMA50 op 1H.`,
    },
    {
      key: 'approaching_zone',
      label: isLong ? 'Nadert/doorbreekt resistance' : 'Nadert/doorbreekt support',
      met: approachingOrBreaking,
      detail: `Prijs ${approachingOrBreaking ? 'nadert of doorbreekt' : 'is nog niet dicht bij'} de ${isLong ? 'resistance' : 'support'}-zone rond ${formatUsdPrice(zone.price)}.`,
    },
  ];

  if (!contextConditions.every((c) => c.met)) return null;

  const candleClosed = isFinalCandle(candles1h);
  const volumeOk = isVolumeConfirming(analysis.volume.classification);
  const momentumOk = tf1h.momentum.classification !== 'weakening';
  const fundingOk = isLong
    ? analysis.positioning.fundingState !== 'very_elevated'
    : analysis.positioning.fundingState !== 'very_low';

  const confirmationConditions: SetupCondition[] = [
    {
      key: 'structural_break',
      label: `1H close ${isLong ? 'boven resistance' : 'onder support'}`,
      met: structureBreak && candleClosed,
      detail: !structureBreak
        ? 'Nog geen gestructureerde uitbraak.'
        : candleClosed
          ? 'Laatste 1H-candle is gesloten voorbij de zone.'
          : 'Prijs staat voorbij de zone, maar de 1H-candle is nog niet gesloten.',
    },
    { key: 'volume', label: 'Relative volume', met: volumeOk, detail: `Volume-classificatie: ${analysis.volume.classification}.` },
    { key: 'momentum', label: 'Momentum houdt stand', met: momentumOk, detail: `Momentum-classificatie: ${tf1h.momentum.classification}.` },
    { key: 'funding', label: 'Funding niet extreem', met: fundingOk, detail: `Funding-status: ${analysis.positioning.fundingState}.` },
  ];

  const readiness = deriveReadiness(contextConditions, confirmationConditions, nearZone);
  if (readiness === 'none') return null;

  const invalidationPrice = applyAtrBuffer(zone.price, atr, SETUP_RULES.atr.invalidationBufferMult, direction);
  const trigger: SetupLevel = {
    price: zone.price,
    timeframe: '1h',
    method: isLong ? '1H close boven recente resistance-zone' : '1H close onder recente support-zone',
    explanation: `Zone gebaseerd op recente swing-${isLong ? 'highs' : 'lows'} op 1H (${zone.touches}x getest).`,
  };
  const invalidation: SetupLevel = {
    price: invalidationPrice,
    timeframe: '1h',
    method: `${SETUP_RULES.atr.invalidationBufferMult}x ATR(14) voorbij de gebroken zone`,
    explanation: `Als de vorige ${isLong ? 'resistance (nu support)' : 'support (nu resistance)'} met een kleine marge terug wordt overschreden, vervalt de thesis.`,
  };

  const opposingZone = isLong ? tf1h.structure.nearestSupport : tf1h.structure.nearestResistance;
  const targets = [
    buildAtrTarget(price, atr, SETUP_RULES.atr.targetNearMult, direction, invalidationPrice, '1h'),
    opposingZone
      ? buildMeasuredMoveTarget(price, zone.price, opposingZone.price, direction, invalidationPrice, '1h')
      : buildAtrTarget(price, atr, SETUP_RULES.atr.targetFarMult, direction, invalidationPrice, '1h'),
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  const supporting: SetupEvidence[] = [
    tf4h ? evidence('trend', `4H trend ${tf4h.trend.classification}`, `4H trend ondersteunt de ${direction}-richting.`) : null,
    evidence('market_structure', 'Structurele uitbraak', `1H structuur toont ${tf1h.structure.signal}.`),
    volumeOk ? evidence('volume', 'Verhoogd volume', `Relative volume is ${analysis.volume.relativeVolume?.toFixed(1)}x het gemiddelde.`) : null,
    momentumOk ? evidence('momentum', 'Momentum houdt stand', `Momentum is ${tf1h.momentum.classification}, niet verzwakkend.`) : null,
  ].filter((e): e is SetupEvidence => e !== null);

  const opposing: SetupEvidence[] = [];
  if (tf1h.volatility.classification === 'extreme') {
    opposing.push(evidence('volatility', 'Extreme volatility', 'ATR ligt ver boven het recente gemiddelde — grotere kans op valse signalen.'));
  }
  if (!fundingOk) {
    opposing.push(evidence('futures_positioning', 'Extreme funding', `Funding-status ${analysis.positioning.fundingState} kan wijzen op overvolle positionering.`));
  }

  return {
    direction,
    family: FAMILY_ID,
    readiness,
    trigger,
    invalidation,
    entryZone: { low: Math.min(price, zone.price), high: Math.max(price, zone.price) },
    targets,
    supporting,
    opposing,
    missingData,
    atr,
  };
}

export const trendContinuationBreakout: FamilyDefinition = {
  id: FAMILY_ID,
  label: 'Trend continuation breakout',
  documentation:
    'Context: 4H trend uptrend of transition-bullish (SHORT: downtrend/transition-bearish), 1D trend niet tegengesteld, prijs boven/onder EMA20+EMA50 op 1H, EMA20/50-uitlijning mee, prijs nadert/doorbreekt een resistance/support-zone. Confirmation: 1H candle sluit voorbij de zone, relative volume elevated of hoger, momentum niet weakening, funding niet extreem tegen de richting in.',
  evaluate: (input) => {
    const results = [evaluateDirection(input, 'LONG'), evaluateDirection(input, 'SHORT')].filter(
      (r): r is FamilyResult => r !== null,
    );
    return results.length ? results : null;
  },
};
