/**
 * Shared setup-quality rubric (Deel 5 of the brief) — used by both phases so
 * a phase-2 requalification is directly comparable to phase 1's original
 * grade. A+/A/B are all tradeable; only C/D are not. This exists specifically
 * to stop System E from only ever accepting near-perfect setups: a B grade
 * is a normal, legitimate LONG/SHORT, not a fallback WAIT.
 */
export const SETUP_QUALITY_VALUES = ['A+', 'A', 'B', 'C', 'D'] as const;
export type SetupQuality = (typeof SETUP_QUALITY_VALUES)[number];

export const SETUP_QUALITY_LABEL: Record<SetupQuality, string> = {
  'A+': 'Uitzonderlijk sterk en zeldzaam',
  A: 'Sterke setup',
  B: 'Valide, goed genoeg om te overwegen',
  C: 'Matig, onvoldoende voordeel',
  D: 'Slecht of onlogisch',
};
