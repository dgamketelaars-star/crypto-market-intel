import { SETUP_RULES } from './rules';
import type { SetupDirection, SetupEvidence } from './types';
import type { FamilyResult } from '../families/shared';

export type SymbolResolutionOutcome = 'active_long' | 'active_short' | 'no_setup' | 'conflicted';

export interface DirectionScore {
  direction: SetupDirection;
  /** Distinct supporting evidence groups, de-duplicated across every family result for this direction. */
  netScore: number;
  qualifies: boolean;
  results: FamilyResult[];
  best: FamilyResult | null;
}

export interface SymbolResolution {
  outcome: SymbolResolutionOutcome;
  long: DirectionScore;
  short: DirectionScore;
  /** Human-readable reason, used for the "why was the opposite direction rejected?" disclosure and debug view. */
  reason: string;
}

/** Anything with evidence lists — both FamilyResult and GeneratedSetup satisfy this, so the same dedup scoring works for the engine's activation-time resolver and the display-layer visibility resolver. */
export interface HasEvidence {
  supporting: SetupEvidence[];
  opposing: SetupEvidence[];
}

/** Distinct supporting evidence groups, de-duplicated across every item, minus distinct opposing groups — avoids double-counting closely related indicators or multiple families citing the same signal. */
export function netEvidenceScore(items: HasEvidence[]): number {
  const supportGroups = new Set<SetupEvidence['group']>();
  const opposeGroups = new Set<SetupEvidence['group']>();
  for (const item of items) {
    for (const e of item.supporting) supportGroups.add(e.group);
    for (const e of item.opposing) opposeGroups.add(e.group);
  }
  return supportGroups.size - opposeGroups.size;
}

function pickBest(results: FamilyResult[]): FamilyResult | null {
  if (results.length === 0) return null;
  return [...results].sort((a, b) => netEvidenceScore([b]) - netEvidenceScore([a]))[0];
}

function scoreDirection(direction: SetupDirection, readyResults: FamilyResult[]): DirectionScore {
  const netScore = netEvidenceScore(readyResults);
  return {
    direction,
    netScore,
    qualifies: readyResults.length > 0 && netScore >= SETUP_RULES.conflict.minActivationScore,
    results: readyResults,
    best: pickBest(readyResults),
  };
}

/**
 * Resolves the symbol-level outcome across every family+direction result that
 * is fully confirmed ("active_ready") this tick. This is the gate that
 * decides whether *any* setup is allowed to activate, and — if both
 * directions have real, independent evidence — refuses to pick a side.
 *
 * Rules (documented, deterministic):
 * - A direction only "qualifies" once it has at least one active_ready
 *   result AND its net independent-evidence-group score is >= minActivationScore
 *   (2 groups) — a single weak rule firing is never enough on its own.
 * - If only one direction qualifies, it wins.
 * - If both qualify, the one with the higher net score wins, but only if it
 *   leads by at least dominanceMargin (1) net group. A tie or a narrow lead
 *   is not "clearly dominant" — that's Conflicted, and no setup is shown.
 */
export function resolveSymbolDirection(freshResults: FamilyResult[]): SymbolResolution {
  const longReady = freshResults.filter((r) => r.direction === 'LONG' && r.readiness === 'active_ready');
  const shortReady = freshResults.filter((r) => r.direction === 'SHORT' && r.readiness === 'active_ready');

  const long = scoreDirection('LONG', longReady);
  const short = scoreDirection('SHORT', shortReady);

  if (!long.qualifies && !short.qualifies) {
    return { outcome: 'no_setup', long, short, reason: 'Geen van beide richtingen heeft voldoende onafhankelijke bevestiging.' };
  }

  if (long.qualifies && !short.qualifies) {
    return {
      outcome: 'active_long',
      long,
      short,
      reason:
        short.results.length > 0
          ? `SHORT werd afgewezen: onvoldoende onafhankelijke bevestiging (score ${short.netScore} tegenover LONG score ${long.netScore}).`
          : 'Geen SHORT-signaal gedetecteerd.',
    };
  }

  if (short.qualifies && !long.qualifies) {
    return {
      outcome: 'active_short',
      long,
      short,
      reason:
        long.results.length > 0
          ? `LONG werd afgewezen: onvoldoende onafhankelijke bevestiging (score ${long.netScore} tegenover SHORT score ${short.netScore}).`
          : 'Geen LONG-signaal gedetecteerd.',
    };
  }

  // Both qualify — only a clear lead resolves the conflict.
  const diff = long.netScore - short.netScore;
  if (diff >= SETUP_RULES.conflict.dominanceMargin) {
    return {
      outcome: 'active_long',
      long,
      short,
      reason: `LONG domineert: score ${long.netScore} tegenover SHORT score ${short.netScore} (marge >= ${SETUP_RULES.conflict.dominanceMargin}).`,
    };
  }
  if (-diff >= SETUP_RULES.conflict.dominanceMargin) {
    return {
      outcome: 'active_short',
      long,
      short,
      reason: `SHORT domineert: score ${short.netScore} tegenover LONG score ${long.netScore} (marge >= ${SETUP_RULES.conflict.dominanceMargin}).`,
    };
  }

  return {
    outcome: 'conflicted',
    long,
    short,
    reason: `LONG (score ${long.netScore}) en SHORT (score ${short.netScore}) zijn beide voldoende onderbouwd zonder duidelijke overhand — geen setup getoond.`,
  };
}
