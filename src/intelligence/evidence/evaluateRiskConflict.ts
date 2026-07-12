import { fact, categoryEvidence } from './build';
import type { CategoryEvidence } from './types';
import { leansWith, stronglyOpposes, type ThesisDirection } from '../thesis/types';

export interface RiskConflictInput {
  bias: ThesisDirection;
  layerBCategories: CategoryEvidence[];
  volatilityExtreme: boolean;
  sourceTimestamp: number;
}

/**
 * Risk/conflict is a Layer C category that never creates a direction — it
 * only surfaces how much internal disagreement exists across the categories
 * already gathered, for the decision flow's final "resolve all opposing
 * evidence" step (see the decision-flow spec). Two or more Layer B
 * categories actively opposing the working bias, combined with extreme
 * volatility, is flagged as 'conflicted' even when each individual category
 * passed its own check — a last coherence check, not a new veto rule.
 */
export function evaluateRiskConflict(input: RiskConflictInput): CategoryEvidence {
  const { bias, layerBCategories, volatilityExtreme, sourceTimestamp } = input;

  const opposingCount = layerBCategories.filter((c) => stronglyOpposes(bias, c)).length;
  const agreeingCount = layerBCategories.filter((c) => leansWith(bias, c)).length;

  const supporting = [fact(`${agreeingCount}/${layerBCategories.length} Layer B categories agree with the working ${bias} bias; ${opposingCount} strongly oppose it.`, 'multi', sourceTimestamp)];
  if (volatilityExtreme) supporting.push(fact('Volatility is currently extreme — data is noisier and conclusions less reliable.', 'multi', sourceTimestamp));

  const conflicted = opposingCount >= 2 || (opposingCount >= 1 && volatilityExtreme);

  return categoryEvidence({
    category: 'risk_conflict',
    conclusion: conflicted ? 'conflicted' : 'neutral',
    supporting,
    timeframe: 'multi',
    sourceTimestamp,
  });
}
