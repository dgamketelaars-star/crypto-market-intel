import { netEvidenceScore } from './conflictResolution';
import { SETUP_RULES } from './rules';
import { OPEN_SETUP_STATUSES, type GeneratedSetup, type SetupDirection } from './types';

export type SymbolVisibilityOutcome = 'long' | 'short' | 'conflicted';

export interface SymbolVisibility {
  symbol: string;
  outcome: SymbolVisibilityOutcome;
  /** The single setup shown to the user for this symbol — null when conflicted (both directions hidden). */
  visible: GeneratedSetup | null;
  longScore: number;
  shortScore: number;
  /** Human-readable reason, used for the debug view — never shown to normal users. */
  reason: string;
}

function statusRank(status: GeneratedSetup['status']): number {
  if (status === 'active') return 0;
  if (status === 'waiting_for_confirmation') return 1;
  return 2; // candidate
}

/** Picks the single best setup within one already-chosen direction: most advanced status first, then strongest net evidence, then most recently evaluated. */
function pickBest(setups: GeneratedSetup[]): GeneratedSetup | null {
  if (setups.length === 0) return null;
  return [...setups].sort((a, b) => {
    const statusDiff = statusRank(a.status) - statusRank(b.status);
    if (statusDiff !== 0) return statusDiff;
    const scoreDiff = netEvidenceScore([b]) - netEvidenceScore([a]);
    if (scoreDiff !== 0) return scoreDiff;
    return b.lastEvaluatedAt - a.lastEvaluatedAt;
  })[0];
}

/**
 * Enforces "at most one visible setup per symbol, never both directions at
 * once" at the display layer, across whatever still-open (candidate /
 * waiting_for_confirmation / active) setups the engine currently holds for
 * that symbol — across every family, regardless of status. This is separate
 * from, and in addition to, the engine's own per-tick activation gate
 * (`resolveSymbolDirection` in conflictResolution.ts, which only scores
 * freshly-confirmed family results for one evaluation cycle). This instead
 * looks at the actual persisted open records right now and decides which
 * single one — if any — a normal user should see.
 *
 * Rules (deterministic, mirrors the engine's own dominance model):
 * - Only one direction present -> it wins, whatever its strength.
 * - Both directions present -> compare net independent-evidence-group
 *   scores (deduplicated across every setup on that side). The side ahead
 *   by at least `dominanceMargin` wins. A tie or a narrow lead is
 *   CONFLICTED — nothing is shown for that symbol.
 */
export function resolveSymbolVisibility(openSetupsForSymbol: GeneratedSetup[]): SymbolVisibility {
  const symbol = openSetupsForSymbol[0]?.symbol ?? '';
  const longs = openSetupsForSymbol.filter((s) => s.direction === 'LONG');
  const shorts = openSetupsForSymbol.filter((s) => s.direction === 'SHORT');
  const longScore = netEvidenceScore(longs);
  const shortScore = netEvidenceScore(shorts);

  const pick = (direction: SetupDirection, list: GeneratedSetup[], reason: string): SymbolVisibility => ({
    symbol,
    outcome: direction === 'LONG' ? 'long' : 'short',
    visible: pickBest(list),
    longScore,
    shortScore,
    reason,
  });

  if (longs.length > 0 && shorts.length === 0) {
    return pick('LONG', longs, 'Alleen LONG-signaal aanwezig voor dit symbool.');
  }
  if (shorts.length > 0 && longs.length === 0) {
    return pick('SHORT', shorts, 'Alleen SHORT-signaal aanwezig voor dit symbool.');
  }

  const diff = longScore - shortScore;
  if (diff >= SETUP_RULES.conflict.dominanceMargin) {
    return pick('LONG', longs, `LONG domineert: score ${longScore} tegenover SHORT score ${shortScore}.`);
  }
  if (-diff >= SETUP_RULES.conflict.dominanceMargin) {
    return pick('SHORT', shorts, `SHORT domineert: score ${shortScore} tegenover LONG score ${longScore}.`);
  }

  return {
    symbol,
    outcome: 'conflicted',
    visible: null,
    longScore,
    shortScore,
    reason: `LONG (score ${longScore}) en SHORT (score ${shortScore}) zijn beide onderbouwd zonder duidelijke overhand — geen setup getoond voor dit symbool.`,
  };
}

export interface VisibleSetupSelection {
  /** At most one setup per symbol, never both directions — this is what the normal UI renders. */
  visible: GeneratedSetup[];
  /** Per-symbol reasoning, for the debug view only. */
  bySymbol: Record<string, SymbolVisibility>;
}

const OPEN_STATUSES = new Set(OPEN_SETUP_STATUSES);

/**
 * The single entry point the normal UI should call before rendering the
 * Setups section: filters out every closed setup (invalidated / completed /
 * expired — those stay in the store for lifecycle history, debugging and
 * future analytics, they just never reach the screen), groups what's left
 * by symbol, and resolves each symbol down to at most one visible setup.
 */
export function selectVisibleSetups(setups: GeneratedSetup[]): VisibleSetupSelection {
  const open = setups.filter((s) => OPEN_STATUSES.has(s.status));

  const grouped = new Map<string, GeneratedSetup[]>();
  for (const setup of open) {
    const list = grouped.get(setup.symbol) ?? [];
    list.push(setup);
    grouped.set(setup.symbol, list);
  }

  const visible: GeneratedSetup[] = [];
  const bySymbol: Record<string, SymbolVisibility> = {};
  for (const [symbol, group] of grouped) {
    const resolution = resolveSymbolVisibility(group);
    bySymbol[symbol] = resolution;
    if (resolution.visible) visible.push(resolution.visible);
  }

  return { visible, bySymbol };
}
