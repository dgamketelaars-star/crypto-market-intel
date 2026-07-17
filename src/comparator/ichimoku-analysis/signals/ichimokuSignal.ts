import { calculateIchimokuLines, evaluateChikou, type IchimokuCandle } from '../indicators/ichimoku';

/**
 * THIS FILE IS OUR OWN ASSEMBLY, not part of the ported pandas-ta-classic
 * indicator maths — see metadata/provenance.ts's ownAssemblyDisclaimer.
 * It implements the standard, widely-documented way experienced Ichimoku
 * traders read the indicator: price position relative to the (displaced)
 * cloud, cloud colour, cloud thickness, TK-cross location, Kumo breakouts,
 * Kijun bounces, and Chikou Span confirmation — combined into a single
 * strong/moderate signal grade rather than a bare cloud-breakout check.
 */
export type IchimokuDirection = 'LONG' | 'SHORT';
export type IchimokuStrength = 'strong' | 'moderate';
export type IchimokuTriggerType = 'tk_cross' | 'kumo_breakout' | 'kijun_bounce';

export interface IchimokuSignal {
  direction: IchimokuDirection;
  strength: IchimokuStrength;
  triggerType: IchimokuTriggerType;
  entryPrice: number;
  kijun: number;
  cloudTop: number;
  cloudBottom: number;
  cloudThicknessPrice: number;
  cloudThicknessPct: number;
  cloudColourAgrees: boolean;
  chikouConfirms: boolean;
  reasons: string[];
  cautions: string[];
}

/** Our own threshold, not upstream's: below this the cloud is "razor thin" — treated as a caution, not a disqualifier. */
export const MIN_CLOUD_THICKNESS_PCT = 0.1;

export function detectIchimokuSignal(candles: IchimokuCandle[]): IchimokuSignal | null {
  const i = candles.length - 1;
  const prev = i - 1;
  if (prev < 0) return null;

  const cur = calculateIchimokuLines(candles, i);
  const before = calculateIchimokuLines(candles, prev);
  if (cur.tenkan == null || cur.kijun == null || cur.senkouA == null || cur.senkouB == null) return null;
  if (before.tenkan == null || before.kijun == null || before.senkouA == null || before.senkouB == null) return null;

  const price = candles[i].close;
  const prevPrice = candles[prev].close;

  const cloudTop = Math.max(cur.senkouA, cur.senkouB);
  const cloudBottom = Math.min(cur.senkouA, cur.senkouB);
  const cloudBullishColour = cur.senkouA > cur.senkouB;
  const cloudThicknessPrice = cloudTop - cloudBottom;
  const cloudThicknessPct = (cloudThicknessPrice / price) * 100;

  const priceAboveCloud = price > cloudTop;
  const priceBelowCloud = price < cloudBottom;
  const priceInsideCloud = !priceAboveCloud && !priceBelowCloud;

  const prevCloudTop = Math.max(before.senkouA, before.senkouB);
  const prevCloudBottom = Math.min(before.senkouA, before.senkouB);

  const tkCrossUp = before.tenkan <= before.kijun && cur.tenkan > cur.kijun;
  const tkCrossDown = before.tenkan >= before.kijun && cur.tenkan < cur.kijun;

  const kumoBreakoutUp = prevPrice <= prevCloudTop && price > cloudTop;
  const kumoBreakoutDown = prevPrice >= prevCloudBottom && price < cloudBottom;

  // Kijun bounce: an established trend (price already beyond the cloud, tenkan on the trend side of
  // kijun) pulls back to touch/cross the kijun line and reclaims it the same bar — a continuation entry.
  const kijunBounceUp = priceAboveCloud && cur.tenkan > cur.kijun && prevPrice <= before.kijun && price > cur.kijun;
  const kijunBounceDown = priceBelowCloud && cur.tenkan < cur.kijun && prevPrice >= before.kijun && price < cur.kijun;

  let direction: IchimokuDirection | null = null;
  let triggerType: IchimokuTriggerType | null = null;

  if (kumoBreakoutUp) {
    direction = 'LONG';
    triggerType = 'kumo_breakout';
  } else if (kumoBreakoutDown) {
    direction = 'SHORT';
    triggerType = 'kumo_breakout';
  } else if (tkCrossUp && priceAboveCloud) {
    direction = 'LONG';
    triggerType = 'tk_cross';
  } else if (tkCrossDown && priceBelowCloud) {
    direction = 'SHORT';
    triggerType = 'tk_cross';
  } else if (kijunBounceUp) {
    direction = 'LONG';
    triggerType = 'kijun_bounce';
  } else if (kijunBounceDown) {
    direction = 'SHORT';
    triggerType = 'kijun_bounce';
  }

  if (!direction || !triggerType) return null;
  // Never trade from inside the cloud — the classic Ichimoku "no trade zone", regardless of trigger type.
  if (priceInsideCloud) return null;

  const chikou = evaluateChikou(candles, i);
  const chikouConfirms = direction === 'LONG' ? chikou.reading === 'above' : chikou.reading === 'below';
  const cloudColourAgrees = direction === 'LONG' ? cloudBullishColour : !cloudBullishColour;
  const cloudThick = cloudThicknessPct >= MIN_CLOUD_THICKNESS_PCT;
  const priceBeyondCloud = direction === 'LONG' ? priceAboveCloud : priceBelowCloud;

  const reasons: string[] = [];
  const cautions: string[] = [];
  let alignedFactors = 0;
  const totalFactors = 4;

  if (priceBeyondCloud) alignedFactors++;
  if (cloudColourAgrees) {
    alignedFactors++;
    reasons.push(direction === 'LONG' ? 'Kumo is bullish (Senkou Span A boven Senkou Span B).' : 'Kumo is bearish (Senkou Span A onder Senkou Span B).');
  } else {
    cautions.push('Kumo-kleur staat niet in lijn met de signaalrichting — het (verschoven) evenwicht werkt tegen deze trade in.');
  }
  if (chikouConfirms) {
    alignedFactors++;
    reasons.push('Chikou Span (huidige close t.o.v. prijs van 26 candles geleden) bevestigt de richting.');
  } else {
    cautions.push('Chikou Span bevestigt de richting niet — huidige close staat niet duidelijk aan de juiste kant van de prijs van 26 candles geleden.');
  }
  if (cloudThick) {
    alignedFactors++;
  } else {
    cautions.push(`Kumo is dun (${cloudThicknessPct.toFixed(2)}% van de prijs) — minder betrouwbare steun/weerstand.`);
  }

  const strength: IchimokuStrength = alignedFactors >= totalFactors - 1 ? 'strong' : 'moderate';

  const triggerLabel: Record<IchimokuTriggerType, string> = {
    tk_cross: `TK-cross (Tenkan/Kijun) ${direction === 'LONG' ? 'omhoog' : 'omlaag'}, boven/onder de kumo`,
    kumo_breakout: `Kumo-breakout ${direction === 'LONG' ? 'naar boven' : 'naar beneden'} door de cloud`,
    kijun_bounce: `Kijun-bounce: prijs raakte de Kijun-sen en herstelde in de trendrichting`,
  };
  reasons.unshift(triggerLabel[triggerType]);

  return {
    direction,
    strength,
    triggerType,
    entryPrice: price,
    kijun: cur.kijun,
    cloudTop,
    cloudBottom,
    cloudThicknessPrice,
    cloudThicknessPct,
    cloudColourAgrees,
    chikouConfirms,
    reasons,
    cautions,
  };
}
