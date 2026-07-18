/**
 * Assembles the system prompt (persona + hard rules, stable across calls —
 * the cacheable prefix) and the per-request user content (System A-D reports
 * + raw Binance data for one symbol, the volatile part) for System E's
 * Messages API call. This module only formats data it is given — it does
 * not read any store itself, keeping it independently testable.
 */
export interface SystemOutputSummary {
  systemId: 'A' | 'B' | 'C' | 'D';
  systemName: string;
  hasSetup: boolean;
  direction?: 'LONG' | 'SHORT';
  status?: string;
  confidenceOrStrength?: string;
  entryDescription?: string;
  stopPrice?: number | null;
  targets?: number[];
  reasoning: string[];
  warnings: string[];
}

export interface CandleLike {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RawMarketSnapshot {
  symbol: string;
  price: number;
  candles1h: CandleLike[];
  candles4h: CandleLike[];
  fundingRatePct: number | null;
  /** Single latest reading, not a trend — no OI history is stored, so we don't fabricate a direction from one point. */
  openInterestValue: number | null;
  longShortRatio: number | null;
  recentLiquidationCount: number;
}

export const SYSTEM_E_SYSTEM_PROMPT = `Je bent een ervaren, onafhankelijke marktanalist gespecialiseerd in crypto futures. Je schrijft een ochtendbriefing voor collega-traders: kort, feitelijk, kritisch, transparant. Geen wollige AI-teksten, geen ongefundeerde zekerheid.

Je krijgt de rapporten van vier gespecialiseerde, onafhankelijke analysesystemen (A, B, C, D) over hetzelfde symbool, plus ruwe Binance-marktdata (candles, funding, open interest, long/short ratio). Je bent GEEN jury die simpelweg bepaalt wie gelijk heeft. Je bent een ervaren analist die eerst de vier rapporten leest, daarna zelf opnieuw naar de ruwe markt kijkt, en dan bewust besluit of je de specialisten volgt of gemotiveerd van hen afwijkt.

Werk ALTIJD in exact deze volgorde:
1. Lees de volledige output van A, B, C en D (richting, confidence/sterkte, entry, stop, targets, status, waarschuwingen). Vorm nog GEEN eigen mening.
2. Maak een objectieve samenvatting: waar zijn de systemen het over eens, waar verschillen ze, welke argumenten komen vaker terug, welke spreken elkaar tegen. Dit is pure synthese, nog geen eigen analyse.
3. Voer daarna een VOLLEDIG ZELFSTANDIGE analyse uit, uitsluitend op basis van de ruwe marktdata, alsof systemen A-D niet bestaan: trend, structuur, support/resistance, hogere timeframes, risk/reward, markt-context, trade-locatie.
4. Vergelijk je eigen analyse met de A-D consensus: waar komt het overeen, waar wijk je af, en waarom.
5. Geef een eindbesluit: LONG, SHORT, WAIT of NO_TRADE, met confidence en volledige motivatie.

Harde regels:
- Je mag NOOIT stemmen tellen, simpel middelen, of automatisch de meerderheid volgen. Elke conclusie moet uit echte redenering volgen, niet uit optellen.
- Je mag het volledig oneens zijn met alle vier de systemen (bijv. allemaal LONG, jij NO_TRADE) of juist een kans zien die alle vier missen — beide zijn toegestaan, mits volledig onderbouwd.
- Controleer expliciet op situaties waarin meerdere systemen dezelfde denkfout maken: allemaal achter de beweging aan lopen, allemaal te bullish/bearish, allemaal een slechte trade-locatie negeren, allemaal weerstand onderschatten, allemaal hogere-timeframe-context missen. Benoem dit expliciet als je het ziet — verzin het niet als het er niet is.
- Maak expliciet onderscheid tussen RICHTING ("gaat de prijs waarschijnlijk omhoog") en TRADE-LOCATIE ("is dit NU een goede plek om in te stappen"). Een correcte richting met een slechte locatie is geen goede trade.
- Geen black box: elke conclusie, inclusief het confidence-niveau, moet uitlegbaar zijn met concrete argumenten. Nooit een kaal getal of label zonder onderbouwing.
- Je hoeft niet altijd gelijk te hebben. Het doel is waarde toevoegen door logisch redeneren, niet de hoogste winrate.
- Als de conclusie "geen trade" is, zeg dat zonder aarzeling. Als je afwijkt van de andere systemen, leg precies uit waarom.
- Schrijf in het Nederlands, consistent met de rest van deze applicatie.

Beantwoord uitsluitend via het gegeven gestructureerde schema.`;

function formatSystemSummary(s: SystemOutputSummary): string {
  if (!s.hasSetup) {
    return `Systeem ${s.systemId} (${s.systemName}): geen actieve setup voor dit symbool.`;
  }
  const lines = [
    `Systeem ${s.systemId} (${s.systemName}): ${s.direction} — status: ${s.status} — confidence/sterkte: ${s.confidenceOrStrength ?? 'onbekend'}`,
  ];
  if (s.entryDescription) lines.push(`  Entry: ${s.entryDescription}`);
  if (s.stopPrice != null) lines.push(`  Stop: ${s.stopPrice}`);
  if (s.targets && s.targets.length > 0) lines.push(`  Targets: ${s.targets.join(', ')}`);
  if (s.reasoning.length > 0) lines.push(`  Onderbouwing: ${s.reasoning.join(' | ')}`);
  if (s.warnings.length > 0) lines.push(`  Waarschuwingen: ${s.warnings.join(' | ')}`);
  return lines.join('\n');
}

/** Compact CSV-like formatting to control token usage — full OHLCV is needed for genuine structure/S-R reasoning, so this trims precision and row count rather than dropping columns. */
function formatCandles(label: string, candles: CandleLike[]): string {
  const rows = candles.map((c) => `${new Date(c.openTime).toISOString().slice(0, 16)},${c.open.toFixed(4)},${c.high.toFixed(4)},${c.low.toFixed(4)},${c.close.toFixed(4)},${c.volume.toFixed(0)}`);
  return `${label} (tijd,open,high,low,close,volume):\n${rows.join('\n')}`;
}

export function buildSystemEUserContent(symbol: string, systemSummaries: SystemOutputSummary[], market: RawMarketSnapshot): string {
  const parts: string[] = [];
  parts.push(`# Analyse-opdracht: ${symbol}`);
  parts.push(`Huidige prijs: ${market.price}`);
  if (market.fundingRatePct != null) parts.push(`Funding rate: ${market.fundingRatePct.toFixed(4)}%`);
  if (market.openInterestValue != null) parts.push(`Open interest (huidige waarde, geen trend beschikbaar): ${market.openInterestValue}`);
  if (market.longShortRatio != null) parts.push(`Long/short ratio: ${market.longShortRatio.toFixed(3)}`);
  parts.push(`Recente liquidaties (rolling buffer): ${market.recentLiquidationCount}`);

  parts.push('\n## Stap 1 — Rapporten van systemen A-D');
  parts.push(systemSummaries.map(formatSystemSummary).join('\n\n'));

  parts.push('\n## Ruwe marktdata voor je eigen zelfstandige analyse (stap 3)');
  parts.push(formatCandles('4h candles', market.candles4h));
  parts.push(formatCandles('1h candles', market.candles1h));

  return parts.join('\n');
}
