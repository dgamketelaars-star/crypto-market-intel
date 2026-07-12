import type { AttentionExplanation, AttentionFeature, AttentionLevel } from '../engine/types';

/**
 * Turns an already-computed set of feature buckets into a short, templated
 * explanation. No LLM — plain string templates over structured input, so the
 * output is exactly as deterministic and testable as the classification itself.
 */
export function buildAttentionExplanation(
  symbol: string,
  level: AttentionLevel,
  supporting: AttentionFeature[],
  neutral: AttentionFeature[],
  conflicting: AttentionFeature[],
  missingData: AttentionFeature[],
): AttentionExplanation {
  return {
    level,
    headline: buildHeadline(symbol, level, supporting, conflicting),
    supporting,
    neutral,
    conflicting,
    missingData,
  };
}

function buildHeadline(
  symbol: string,
  level: AttentionLevel,
  supporting: AttentionFeature[],
  conflicting: AttentionFeature[],
): string {
  const base = symbol.replace(/USDT$/, '');

  if (level === 'insufficient_data') {
    return `Nog niet genoeg historische data voor ${base} om dit betrouwbaar te beoordelen.`;
  }

  if (level === 'normal') {
    return `${base} laat momenteel geen ongebruikelijke combinatie van signalen zien.`;
  }

  const labels = [...supporting, ...conflicting].map((f) => f.label);
  const labelText = joinLabels(labels);

  if (level === 'unusual_activity') {
    return `${base} combineert meerdere opvallende signalen: ${labelText}. Dat bepaalt nog geen richting, maar de combinatie verdient een nadere blik.`;
  }

  // worth_watching
  return `${base} wijkt op een paar vlakken af van normaal: ${labelText}. Nog geen sterke bevestiging over meerdere signalen heen.`;
}

function joinLabels(labels: string[]): string {
  if (labels.length === 0) return 'geen specifieke signalen';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} en ${labels[labels.length - 1]}`;
}
