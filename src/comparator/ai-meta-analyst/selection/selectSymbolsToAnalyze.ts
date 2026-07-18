/**
 * Own choice, not part of any upstream system: which symbols are worth
 * spending a real, billed LLM call on this cycle. We only ever consider
 * symbols where at least two of A-D currently have an open setup AND either
 * (a) all of them agree on direction (strong consensus — worth checking
 * whether the agreement is well-founded or a shared blind spot), or
 * (b) they disagree (worth an independent tie-break read). A single lone
 * setup with no second opinion isn't "consensus or disagreement" by
 * definition, so it's skipped — System E's whole value proposition is
 * reading multiple reports against each other.
 */
export interface SymbolDirectionInput {
  symbol: string;
  directions: Array<'LONG' | 'SHORT'>;
}

export type SelectionReason = 'strong_consensus' | 'disagreement';

export interface SelectedSymbol {
  symbol: string;
  reason: SelectionReason;
  systemsWithOpinion: number;
}

export function classifySymbol(input: SymbolDirectionInput): SelectedSymbol | null {
  const { symbol, directions } = input;
  if (directions.length < 2) return null;
  const allSame = directions.every((d) => d === directions[0]);
  return {
    symbol,
    reason: allSame ? 'strong_consensus' : 'disagreement',
    systemsWithOpinion: directions.length,
  };
}

/** Prioritises symbols with the most independent opinions (4-way agreement/disagreement is more informative than 2-way), then alphabetically for determinism. */
export function selectSymbolsToAnalyze(inputs: SymbolDirectionInput[], maxSymbols: number): SelectedSymbol[] {
  const classified = inputs.map(classifySymbol).filter((s): s is SelectedSymbol => s !== null);
  classified.sort((a, b) => b.systemsWithOpinion - a.systemsWithOpinion || a.symbol.localeCompare(b.symbol));
  return classified.slice(0, maxSymbols);
}
