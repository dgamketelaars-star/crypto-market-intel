import type { GeneratedSetup } from '../engine/types';
import { familyLabels } from './setupLabels';

/** A short, templated (not LLM) one-line summary for the compact candidate card. */
export function buildSetupSummary(setup: GeneratedSetup): string {
  const base = setup.symbol.replace(/USDT$/, '');
  const familyText = familyLabels[setup.family];
  const supportCount = setup.supporting.length;
  const opposeCount = setup.opposing.length;

  if (opposeCount === 0) {
    return `${base}: ${familyText} (${setup.direction}) met ${supportCount} ondersteunende signalen.`;
  }
  return `${base}: ${familyText} (${setup.direction}) — ${supportCount} signalen mee, ${opposeCount} tegen.`;
}
