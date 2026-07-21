import type { SystemEPhase1Result } from './phase1Schema';
import { formatSystemSummary, type SystemOutputSummary } from './systemSummary';

/**
 * Phase 2 system prompt — run only after phase 1 (see phase1Prompt.ts) is
 * already locked in and stored. This call receives that phase-1 result
 * PLUS the published output of Systems A-D, and must produce the objective
 * synthesis, the comparison, and the final decision — all in one pass, per
 * Deel 4's fase 2/fase 3 split (they're combined into a single call here
 * since fase 2's synthesis and fase 3's comparison both need the same A-D
 * input in context; the ordering discipline that matters — independent
 * analysis before any A-D exposure — is what phase 1 vs phase 2 enforces).
 */
export const SYSTEM_E_PHASE2_SYSTEM_PROMPT = `Je bent dezelfde ervaren, zelfstandige probabilistische trader als in je eerdere, onafhankelijke analyse. Die eerste analyse (hieronder herhaald) is al vastgelegd voordat je dit las — je verandert die niet, je bouwt erop voort.

Je krijgt nu de gepubliceerde output van vier gespecialiseerde, onafhankelijke analysesystemen (A, B, C, D) over hetzelfde symbool. Je bent GEEN jury die simpelweg bepaalt wie gelijk heeft. Werk in exact deze volgorde:

STAP 1 — Objectieve samenvatting van A-D (nog geen eigen mening):
Waar komen de gepubliceerde outputs overeen, waar verschillen ze, welke argumenten komen vaker terug, welke spreken elkaar tegen, welke systemen hebben geen actieve setup, en welke concrete verschillen zijn er in entry/stop/targets.

METHODOLOGISCH BELANGRIJK — formuleer dit zorgvuldig. Je ziet alleen de gepubliceerde eindconclusie van elk systeem, niet de interne berekening. Schrijf daarom NIET "Systeem C negeert weerstand" — schrijf "In de gepubliceerde output van Systeem C wordt deze weerstand niet expliciet meegewogen". Je weet niet wat een ander systeem intern wel of niet heeft berekend, alleen wat het rapporteert.

STAP 2 — Vergelijking met je eigen eerdere analyse:
Waar kwam je oorspronkelijke analyse overeen met de A-D consensus, waar week je af, en welke SPECIFIEKE informatie uit de gepubliceerde A-D-output (indien van toepassing) verandert je oordeel — niet "de meerderheid zegt iets anders", maar een concreet argument of niveau dat je nog niet had meegewogen.

STAP 3 — Eindbesluit:
Je mag je confidence of besluit uit fase 1 aanpassen, maar uitsluitend op basis van echte, genoemde argumenten uit de A-D-output — nooit door automatisch de meerderheid te volgen, stemmen te tellen, richtingen te middelen, of NO_TRADE te kiezen puur omdat de systemen elkaar tegenspreken. Je oorspronkelijke analyse mag niet zomaar verdwijnen: als niets in de A-D-output je overtuigt, houd je gewoon je eerdere besluit aan.

Dezelfde regels als in je eerste analyse blijven gelden: A+/A/B mogen leiden tot LONG of SHORT (een B-setup is een normaal, legitiem besluit); C leidt normaal tot WAIT; D tot NO_TRADE. WAIT vereist concrete, controleerbare bevestigingscondities in "waitConditions" — geen WAIT zonder duidelijke voorwaarde. NO_TRADE is geen standaard-vluchtroute. Blijf ook hier expliciet controleren op een gedeelde denkfout tussen de systemen (allemaal achter de beweging aan, allemaal te bullish/bearish, allemaal weerstand onderschatten, allemaal hogere-timeframe-context missen) — benoem dit als je het ziet, verzin het niet als het er niet is.

Motivatie: benoem expliciet de belangrijkste edge, het belangrijkste risico, en wat het besluit ongeldig zou maken.

Schrijf in het Nederlands. Beantwoord uitsluitend via het gegeven gestructureerde schema.`;

function formatPhase1Result(phase1: SystemEPhase1Result): string {
  const lines = [
    `Marktregime: ${phase1.marketRegime}`,
    `Richting hogere timeframe: ${phase1.higherTimeframeDirection}`,
    `Kortetermijnstructuur: ${phase1.shortTermStructure}`,
    `Momentum: ${phase1.momentum}`,
    `Support: ${phase1.supportLevels.join(', ') || 'geen'}`,
    `Resistance: ${phase1.resistanceLevels.join(', ') || 'geen'}`,
    `Trade-locatie: ${phase1.tradeLocationAssessment}`,
    `Setupkwaliteit: ${phase1.setupQuality}`,
    `Voorlopig besluit: ${phase1.decision} — confidence: ${phase1.confidence}`,
  ];
  if (phase1.entryZone) lines.push(`Entryzone: ${phase1.entryZone.low}-${phase1.entryZone.high}`);
  if (phase1.invalidation != null) lines.push(`Invalidatie: ${phase1.invalidation}`);
  if (phase1.targets.length > 0) lines.push(`Targets: ${phase1.targets.map((t) => `${t.price} (${t.reason})`).join('; ')}`);
  if (phase1.riskRewardRatio != null) lines.push(`Risk/reward: ${phase1.riskRewardRatio}`);
  if (phase1.argumentsFor.length > 0) lines.push(`Argumenten vóór: ${phase1.argumentsFor.join(' | ')}`);
  if (phase1.argumentsAgainst.length > 0) lines.push(`Argumenten tegen: ${phase1.argumentsAgainst.join(' | ')}`);
  if (phase1.waitConditions.length > 0) lines.push(`Wachtcondities: ${phase1.waitConditions.join(' | ')}`);
  if (phase1.rejectionCheck) lines.push(`Afwijzingscheck: ${phase1.rejectionCheck}`);
  return lines.join('\n');
}

export function buildPhase2UserContent(symbol: string, phase1: SystemEPhase1Result, systemSummaries: SystemOutputSummary[]): string {
  const parts: string[] = [];
  parts.push(`# Vervolg op je eigen onafhankelijke analyse: ${symbol}`);
  parts.push('\n## Je eerdere, onafhankelijke analyse (al vastgelegd, vóórdat je dit las)');
  parts.push(formatPhase1Result(phase1));
  parts.push('\n## Gepubliceerde output van systemen A-D');
  parts.push(systemSummaries.map(formatSystemSummary).join('\n\n'));
  return parts.join('\n');
}
