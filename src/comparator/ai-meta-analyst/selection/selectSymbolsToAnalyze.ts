/**
 * Own choice, not part of any upstream system: which symbols are worth
 * spending real, billed LLM calls on this cycle. We only ever consider
 * symbols where at least two of A-D currently have an open setup — a single
 * lone setup with no second opinion isn't "consensus or disagreement" by
 * definition, and System E's whole value proposition is reading multiple
 * reports against each other.
 *
 * Within that precondition, a symbol qualifies for one of four documented,
 * deterministic reasons (checked in this priority order — the first match
 * wins, since a symbol can technically satisfy more than one):
 *   1. disagreement          — systems don't even agree on LONG vs SHORT.
 *   2. confidence_divergence — same direction, but confidence spans at
 *                               least two ordinal steps (e.g. low vs high).
 *   3. level_divergence      — same direction, similar confidence, but risk
 *                               (stop distance as a % of entry) differs by
 *                               2x or more between systems — one system's
 *                               stop is far tighter or looser than another's
 *                               for what's nominally the same trade.
 *   4. strong_consensus      — everything lines up; still worth a check,
 *                               specifically to catch a shared blind spot.
 */
export type SystemOpinionConfidence = 'low' | 'medium' | 'high';

export interface SystemOpinion {
  direction: 'LONG' | 'SHORT';
  confidence: SystemOpinionConfidence | null;
  entryPrice: number | null;
  stopPrice: number | null;
}

export interface SymbolOpinionInput {
  symbol: string;
  opinions: SystemOpinion[];
}

export type SelectionReason = 'strong_consensus' | 'disagreement' | 'confidence_divergence' | 'level_divergence';

export interface SelectedSymbol {
  symbol: string;
  reason: SelectionReason;
  systemsWithOpinion: number;
}

const CONFIDENCE_RANK: Record<SystemOpinionConfidence, number> = { low: 1, medium: 2, high: 3 };
/** Two full ordinal steps (e.g. low vs high) — a one-step gap (low vs medium) is normal variation, not a divergence worth flagging. */
const CONFIDENCE_DIVERGENCE_THRESHOLD = 2;
/** One system's risk (stop distance as a fraction of entry) is at least double another's. */
const LEVEL_DIVERGENCE_RATIO = 2;

export function classifySymbol(input: SymbolOpinionInput): SelectedSymbol | null {
  const { symbol, opinions } = input;
  if (opinions.length < 2) return null;

  const directions = opinions.map((o) => o.direction);
  const allSameDirection = directions.every((d) => d === directions[0]);
  if (!allSameDirection) {
    return { symbol, reason: 'disagreement', systemsWithOpinion: opinions.length };
  }

  const confidenceRanks = opinions.map((o) => (o.confidence ? CONFIDENCE_RANK[o.confidence] : null)).filter((r): r is number => r !== null);
  if (confidenceRanks.length >= 2 && Math.max(...confidenceRanks) - Math.min(...confidenceRanks) >= CONFIDENCE_DIVERGENCE_THRESHOLD) {
    return { symbol, reason: 'confidence_divergence', systemsWithOpinion: opinions.length };
  }

  const stopDistances = opinions
    .filter((o) => o.entryPrice != null && o.stopPrice != null && o.entryPrice !== 0)
    .map((o) => Math.abs((o.entryPrice! - o.stopPrice!) / o.entryPrice!));
  if (stopDistances.length >= 2) {
    const maxDistance = Math.max(...stopDistances);
    const minDistance = Math.min(...stopDistances);
    if (minDistance > 0 && maxDistance / minDistance >= LEVEL_DIVERGENCE_RATIO) {
      return { symbol, reason: 'level_divergence', systemsWithOpinion: opinions.length };
    }
  }

  return { symbol, reason: 'strong_consensus', systemsWithOpinion: opinions.length };
}

/** Prioritises symbols with the most independent opinions (4-way agreement/disagreement is more informative than 2-way), then alphabetically for determinism. */
export function selectSymbolsToAnalyze(inputs: SymbolOpinionInput[], maxSymbols: number): SelectedSymbol[] {
  const classified = inputs.map(classifySymbol).filter((s): s is SelectedSymbol => s !== null);
  classified.sort((a, b) => b.systemsWithOpinion - a.systemsWithOpinion || a.symbol.localeCompare(b.symbol));
  return classified.slice(0, maxSymbols);
}

/**
 * A coarse, stable fingerprint of "what E would see right now" for a
 * symbol — current price (bucketed, not exact, so normal tick noise doesn't
 * count as a change) plus each system's direction/confidence/stop-distance.
 * Used to skip an automatic re-analysis when nothing meaningful changed
 * since the last one, even if the recheck cooldown has elapsed — a
 * deliberately soft, in-memory-only heuristic, not a hard guarantee.
 */
export function computeSelectionSignature(input: SymbolOpinionInput, price: number): string {
  // 3 significant figures scales the bucket width to the price's own magnitude (fine for a $0.001 altcoin
  // and a $100,000 BTC alike) while still collapsing sub-percent tick noise into the same bucket.
  const priceBucket = price > 0 ? Number(price.toPrecision(3)) : 0;
  const opinionParts = input.opinions
    .map((o) => {
      const stopDistanceBucket = o.entryPrice && o.stopPrice && o.entryPrice !== 0 ? Math.round((Math.abs((o.entryPrice - o.stopPrice) / o.entryPrice) * 1000) / 5) * 5 : 'x';
      return `${o.direction}:${o.confidence ?? '-'}:${stopDistanceBucket}`;
    })
    .sort()
    .join('|');
  return `${priceBucket}#${opinionParts}`;
}
