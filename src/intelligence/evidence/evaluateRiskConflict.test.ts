import { describe, expect, it } from 'vitest';
import { categoryEvidence } from './build';
import { evaluateRiskConflict } from './evaluateRiskConflict';

function evidence(category: 'trend' | 'momentum' | 'volume', conclusion: Parameters<typeof categoryEvidence>[0]['conclusion']) {
  return categoryEvidence({ category, conclusion, timeframe: 'multi', sourceTimestamp: 1 });
}

describe('evaluateRiskConflict', () => {
  it('is neutral when Layer B categories mostly agree with the bias', () => {
    const result = evaluateRiskConflict({
      bias: 'LONG',
      layerBCategories: [evidence('trend', 'bullish'), evidence('momentum', 'bullish'), evidence('volume', 'neutral')],
      volatilityExtreme: false,
      sourceTimestamp: 1,
    });
    expect(result.conclusion).toBe('neutral');
  });

  it('flags conflicted when two or more Layer B categories strongly oppose the bias', () => {
    const result = evaluateRiskConflict({
      bias: 'LONG',
      layerBCategories: [evidence('trend', 'bearish'), evidence('momentum', 'bearish'), evidence('volume', 'neutral')],
      volatilityExtreme: false,
      sourceTimestamp: 1,
    });
    expect(result.conclusion).toBe('conflicted');
  });

  it('flags conflicted when one category opposes and volatility is extreme', () => {
    const result = evaluateRiskConflict({
      bias: 'SHORT',
      layerBCategories: [evidence('trend', 'bullish'), evidence('momentum', 'neutral'), evidence('volume', 'neutral')],
      volatilityExtreme: true,
      sourceTimestamp: 1,
    });
    expect(result.conclusion).toBe('conflicted');
  });

  it('does not flag conflicted from extreme volatility alone with no opposition', () => {
    const result = evaluateRiskConflict({
      bias: 'SHORT',
      layerBCategories: [evidence('trend', 'bearish'), evidence('momentum', 'neutral'), evidence('volume', 'neutral')],
      volatilityExtreme: true,
      sourceTimestamp: 1,
    });
    expect(result.conclusion).toBe('neutral');
  });
});
