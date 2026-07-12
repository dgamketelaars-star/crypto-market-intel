import { deriveReadiness } from '../engine/readiness';
import { evidence } from '../engine/evidence';
import { SETUP_RULES } from '../engine/rules';
import type { SetupCondition, SetupDirection, SetupEvidence, SetupLevel } from '../engine/types';
import { applyAtrBuffer, isWithinAtr } from '../levels/atrBuffer';
import { buildAtrTarget, buildZoneTarget } from '../levels/targets';
import { isFinalCandle, type FamilyDefinition, type FamilyEvaluationInput, type FamilyResult } from './shared';

const FAMILY_ID = 'trend_continuation_pullback' as const;

function evaluateDirection(input: FamilyEvaluationInput, direction: SetupDirection): FamilyResult | null {
  const { analysis, price, candles1h } = input;
  const isLong = direction === 'LONG';
  const tf1h = analysis.timeframes['1h'];
  const tf4h = analysis.timeframes['4h'];
  if (!tf1h || !tf1h.trend.sufficientData || !tf1h.volatility.sufficientData) return null;

  const atr = tf1h.volatility.atr14.value;
  const ema20 = tf1h.trend.ema20.value;
  const ema50 = tf1h.trend.ema50.value;
  if (atr === null || atr <= 0 || ema20 === null || ema50 === null) return null;

  const missingData: SetupEvidence[] = [];

  const trend4hOk = tf4h ? (isLong ? tf4h.trend.classification === 'uptrend' : tf4h.trend.classification === 'downtrend') : false;
  if (!tf4h) missingData.push(evidence('trend', '4H trend', 'Onvoldoende 4H-candles — pullback wordt niet zonder bevestigde trend beoordeeld.'));

  const nearEma20 = isWithinAtr(price, ema20, atr, SETUP_RULES.atr.pullbackZoneMult);
  const stillAboveStructure = isLong ? price > ema50 : price < ema50;
  const structureIntact = isLong ? tf1h.structure.signal !== 'breakdown_candidate' : tf1h.structure.signal !== 'breakout_candidate';

  const contextConditions: SetupCondition[] = [
    { key: 'trend_4h', label: '4H trend bevestigd', met: trend4hOk, detail: tf4h ? `4H trend is ${tf4h.trend.classification}.` : 'Onvoldoende 4H-data.' },
    {
      key: 'near_ema20',
      label: 'Prijs nabij EMA20 (1H)',
      met: nearEma20,
      detail: nearEma20 ? 'Prijs bevindt zich binnen de pullback-zone rond EMA20 (1H).' : 'Prijs is (nog) niet teruggevallen naar EMA20.',
    },
    {
      key: 'above_ema50',
      label: isLong ? 'Boven EMA50 (structuur intact)' : 'Onder EMA50 (structuur intact)',
      met: stillAboveStructure,
      detail: stillAboveStructure ? 'De onderliggende trendstructuur (EMA50) is nog niet gebroken.' : 'Prijs staat al voorbij EMA50 — dit is geen gezonde pullback meer.',
    },
    {
      key: 'structure_intact',
      label: 'Geen tegengestelde structuurbreuk',
      met: structureIntact,
      detail: structureIntact ? 'Geen structuurbreuk in de tegengestelde richting.' : 'Structuur toont al een breuk in de tegengestelde richting.',
    },
  ];

  if (!contextConditions.every((c) => c.met)) return null;

  const reclaimBuffer = atr * 0.15;
  const reclaimed = isLong ? price >= ema20 + reclaimBuffer : price <= ema20 - reclaimBuffer;
  const candleClosed = isFinalCandle(candles1h);
  const momentumOk = tf1h.momentum.classification === 'strengthening' || tf1h.momentum.classification === 'neutral';
  const volumeOk = analysis.volume.classification !== 'low';

  const confirmationConditions: SetupCondition[] = [
    {
      key: 'reclaim',
      label: isLong ? '1H close terug boven EMA20' : '1H close terug onder EMA20',
      met: reclaimed && candleClosed,
      detail: reclaimed
        ? candleClosed
          ? 'Laatste 1H-candle sluit weer aan de trendzijde van EMA20.'
          : 'Prijs staat weer aan de trendzijde van EMA20, maar de candle is nog niet gesloten.'
        : 'Prijs heeft EMA20 nog niet heroverd.',
    },
    { key: 'momentum', label: 'Momentum draait mee', met: momentumOk, detail: `Momentum-classificatie: ${tf1h.momentum.classification}.` },
    { key: 'volume', label: 'Voldoende deelname', met: volumeOk, detail: `Volume-classificatie: ${analysis.volume.classification}.` },
  ];

  const nearZone = nearEma20;
  const readiness = deriveReadiness(contextConditions, confirmationConditions, nearZone);
  if (readiness === 'none') return null;

  const invalidationPrice = applyAtrBuffer(ema50, atr, SETUP_RULES.atr.invalidationBufferMult, direction);
  const trigger: SetupLevel = {
    price: ema20 + (isLong ? reclaimBuffer : -reclaimBuffer),
    timeframe: '1h',
    method: isLong ? '1H close terug boven EMA20 (pullback-bevestiging)' : '1H close terug onder EMA20 (pullback-bevestiging)',
    explanation: 'De prijs heeft EMA20 als dynamische steun/weerstand getest en bevestigt de trend opnieuw.',
  };
  const invalidation: SetupLevel = {
    price: invalidationPrice,
    timeframe: '1h',
    method: `EMA50(1H) ${SETUP_RULES.atr.invalidationBufferMult}x ATR-marge`,
    explanation: 'Een close voorbij EMA50 met een kleine marge betekent dat de trendstructuur zelf is gebroken.',
  };

  const resistanceZone = isLong ? tf1h.structure.nearestResistance : tf1h.structure.nearestSupport;
  const targets = [
    buildAtrTarget(price, atr, SETUP_RULES.atr.targetNearMult, direction, invalidationPrice, '1h'),
    resistanceZone
      ? buildZoneTarget(price, resistanceZone.price, isLong ? 'resistance' : 'support', direction, invalidationPrice, '1h')
      : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  const supporting: SetupEvidence[] = [
    tf4h ? evidence('trend', `4H trend ${tf4h.trend.classification}`, 'Bredere trend ondersteunt voortzetting na de pullback.') : null,
    evidence('market_structure', 'EMA20 als dynamische zone', 'Prijs reageert op EMA20 zoals verwacht in een gezonde trend.'),
    momentumOk ? evidence('momentum', 'Momentum draait mee', `Momentum-classificatie: ${tf1h.momentum.classification}.`) : null,
  ].filter((e): e is SetupEvidence => e !== null);

  const opposing: SetupEvidence[] = [];
  if (analysis.volume.classification === 'low') {
    opposing.push(evidence('volume', 'Lage deelname', 'Volume tijdens de pullback-bevestiging is laag.'));
  }

  return {
    direction,
    family: FAMILY_ID,
    readiness,
    trigger,
    invalidation,
    entryZone: isLong ? { low: ema20, high: ema20 + reclaimBuffer * 2 } : { low: ema20 - reclaimBuffer * 2, high: ema20 },
    targets,
    supporting,
    opposing,
    missingData,
    atr,
  };
}

export const trendContinuationPullback: FamilyDefinition = {
  id: FAMILY_ID,
  label: 'Trend continuation pullback',
  documentation:
    'Context: bevestigde 4H trend, 1H prijs teruggevallen naar EMA20 (binnen 1x ATR) maar EMA50 nog niet gebroken, geen tegengestelde structuurbreuk. Confirmation: 1H candle sluit terug aan de trendzijde van EMA20, momentum draait mee (strengthening/neutral), voldoende deelname (volume niet low).',
  evaluate: (input) => {
    const results = [evaluateDirection(input, 'LONG'), evaluateDirection(input, 'SHORT')].filter(
      (r): r is FamilyResult => r !== null,
    );
    return results.length ? results : null;
  },
};
