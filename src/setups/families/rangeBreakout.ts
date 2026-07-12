import { deriveReadiness } from '../engine/readiness';
import { evidence } from '../engine/evidence';
import { isVolumeConfirming, SETUP_RULES } from '../engine/rules';
import type { SetupCondition, SetupDirection, SetupEvidence, SetupLevel } from '../engine/types';
import { applyAtrBuffer, isWithinAtr } from '../levels/atrBuffer';
import { buildAtrTarget, buildMeasuredMoveTarget } from '../levels/targets';
import { isFinalCandle, type FamilyDefinition, type FamilyEvaluationInput, type FamilyResult } from './shared';

const FAMILY_ID = 'range_breakout' as const;

function evaluateDirection(input: FamilyEvaluationInput, direction: SetupDirection): FamilyResult | null {
  const { analysis, price, candles1h } = input;
  const isLong = direction === 'LONG';
  const tf1h = analysis.timeframes['1h'];
  if (!tf1h || !tf1h.trend.sufficientData || !tf1h.volatility.sufficientData) return null;

  const atr = tf1h.volatility.atr14.value;
  if (atr === null || atr <= 0) return null;

  const { nearestSupport, nearestResistance } = tf1h.structure;
  if (!nearestSupport || !nearestResistance) return null;

  const zone = isLong ? nearestResistance : nearestSupport;
  const opposingZone = isLong ? nearestSupport : nearestResistance;

  const rangeIsSideways = tf1h.trend.classification === 'sideways';
  const nearZone = isWithinAtr(price, zone.price, atr, SETUP_RULES.proximity.triggerProximityAtrMult);
  // Price vs. the zone (not the analysis engine's single-tick signal) so
  // confirmation stays checkable for a few candles after the initial break —
  // see trendContinuationBreakout.ts for the full rationale.
  const zoneBuffer = 0.0015;
  const structureBreak = isLong ? price > zone.price * (1 + zoneBuffer) : price < zone.price * (1 - zoneBuffer);

  const contextConditions: SetupCondition[] = [
    { key: 'range_bound', label: '1H markt is range-bound', met: rangeIsSideways, detail: `1H trendclassificatie is ${tf1h.trend.classification}.` },
    {
      key: 'both_zones',
      label: 'Range met support én resistance gedefinieerd',
      met: true,
      detail: `Support rond ${nearestSupport.price}, resistance rond ${nearestResistance.price}.`,
    },
    {
      key: 'approaching_zone',
      label: isLong ? 'Nadert/doorbreekt range-top' : 'Nadert/doorbreekt range-bodem',
      met: structureBreak || nearZone,
      detail: `Prijs ${structureBreak || nearZone ? 'nadert of doorbreekt' : 'is nog niet dicht bij'} de rand van de range.`,
    },
  ];

  if (!contextConditions.every((c) => c.met)) return null;

  const candleClosed = isFinalCandle(candles1h);
  const volumeOk = isVolumeConfirming(analysis.volume.classification);
  const momentumOk = tf1h.momentum.classification !== 'weakening';

  const confirmationConditions: SetupCondition[] = [
    {
      key: 'structural_break',
      label: `1H close ${isLong ? 'boven range-top' : 'onder range-bodem'}`,
      met: structureBreak && candleClosed,
      detail: !structureBreak
        ? 'Nog geen bevestigde uitbraak uit de range.'
        : candleClosed
          ? 'Laatste 1H-candle sluit buiten de range.'
          : 'Prijs staat buiten de range, maar de candle is nog niet gesloten.',
    },
    { key: 'volume', label: 'Relative volume', met: volumeOk, detail: `Volume-classificatie: ${analysis.volume.classification}.` },
    { key: 'momentum', label: 'Momentum niet verzwakkend', met: momentumOk, detail: `Momentum-classificatie: ${tf1h.momentum.classification}.` },
  ];

  const readiness = deriveReadiness(contextConditions, confirmationConditions, nearZone);
  if (readiness === 'none') return null;

  const invalidationPrice = applyAtrBuffer(zone.price, atr, SETUP_RULES.atr.invalidationBufferMult, direction);
  const trigger: SetupLevel = {
    price: zone.price,
    timeframe: '1h',
    method: isLong ? '1H close boven de range-top' : '1H close onder de range-bodem',
    explanation: `Rand van een range die op 1H al ${zone.touches}x is getest.`,
  };
  const invalidation: SetupLevel = {
    price: invalidationPrice,
    timeframe: '1h',
    method: `${SETUP_RULES.atr.invalidationBufferMult}x ATR(14) terug in de range`,
    explanation: 'Terugval in de range met een kleine marge betekent een valse uitbraak.',
  };

  const targets = [
    buildMeasuredMoveTarget(price, zone.price, opposingZone.price, direction, invalidationPrice, '1h'),
    buildAtrTarget(price, atr, SETUP_RULES.atr.targetNearMult, direction, invalidationPrice, '1h'),
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  const supporting: SetupEvidence[] = [
    evidence('market_structure', 'Range-uitbraak', `1H structuur toont ${tf1h.structure.signal}.`),
    volumeOk ? evidence('volume', 'Verhoogd volume', `Relative volume is ${analysis.volume.relativeVolume?.toFixed(1)}x het gemiddelde.`) : null,
    evidence('trend', 'Duidelijke range', `Range met ${nearestSupport.touches + nearestResistance.touches} zone-tests op 1H.`),
  ].filter((e): e is SetupEvidence => e !== null);

  const opposing: SetupEvidence[] = [];
  if (tf1h.volatility.classification === 'low') {
    opposing.push(evidence('volatility', 'Lage volatility', 'Lage ATR kan wijzen op een nog niet overtuigende uitbraak.'));
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
    missingData: [],
    atr,
  };
}

export const rangeBreakout: FamilyDefinition = {
  id: FAMILY_ID,
  label: 'Range breakout',
  documentation:
    'Context: 1H trend is sideways met een gedefinieerde support- én resistance-zone, prijs nadert/doorbreekt een van beide randen. Confirmation: 1H candle sluit buiten de range, relative volume elevated of hoger, momentum niet weakening.',
  evaluate: (input) => {
    const results = [evaluateDirection(input, 'LONG'), evaluateDirection(input, 'SHORT')].filter(
      (r): r is FamilyResult => r !== null,
    );
    return results.length ? results : null;
  },
};
