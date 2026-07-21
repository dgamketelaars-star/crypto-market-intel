import type { IndependentAnalysisDirection } from '../adapters/independentAnalysisSetup';
import type { SystemCSetupState } from '../lifecycle/systemCLifecycle';

export function explainMarketInterpretation(setup: SystemCSetupState): string {
  const sweepWord = setup.direction === 'LONG' ? 'onder de markt geclusterde gelijke lows (bullish liquidity)' : 'boven de markt geclusterde gelijke highs (bearish liquidity)';
  const structureWord = setup.direction === 'LONG' ? 'bullish' : 'bearish';
  return `Prijs veegde eerst ${sweepWord} weg, gevolgd door een bevestigde structuurwijziging (BOS/CHOCH, ${structureWord}) terug de andere kant op — het klassieke "liquidity sweep + structural reclaim" patroon.`;
}

export function explainSetupType(): string {
  return 'Liquidity sweep + structurele reclaim (market structure + liquidity school)';
}

export function explainTriggerCondition(direction: IndependentAnalysisDirection): string {
  return direction === 'LONG'
    ? 'Bevestigde bullish BOS/CHOCH na het wegvegen van geclusterde lows — entry pas geldig na het sluiten van de bevestigende candle.'
    : 'Bevestigde bearish BOS/CHOCH na het wegvegen van geclusterde highs — entry pas geldig na het sluiten van de bevestigende candle.';
}

export function explainInvalidationReason(): string {
  return 'Stop staat net voorbij het extreme punt van de candle die de liquidity wegveegde — als prijs daar opnieuw doorheen gaat is de reclaim mislukt en is de these ongeldig.';
}

export function explainSupportingObservations(setup: SystemCSetupState): string[] {
  return [
    `Liquidity zone geveegd op index met niveau ≈ ${setup.sweepZone.level.toFixed(4)}.`,
    `Structurele bevestiging op niveau ≈ ${setup.confirmingEventLevel.toFixed(4)}.`,
    `Doel: ${setup.targetPrice.toFixed(4)} — ${setup.targetReason}`,
  ];
}

export function explainOpposingObservations(): string[] {
  return ['Deze eigen assemblage van entry/stop/doel-regels is niet gevalideerd op historische out-of-sample data — zie provenance.ts.'];
}

export function explainClose(reason: SystemCSetupState['closedReason']): string {
  switch (reason) {
    case 'stop':
      return 'Structurele stop geraakt — de reclaim over de geveegde liquidity mislukte.';
    case 'target':
      return 'Doel bereikt (tegengestelde liquidity zone of structurele swing).';
    case 'vanished':
      return 'Symbool viel uit de gevolgde Top-50 universe — tracking kon niet worden voortgezet.';
    default:
      return 'Gesloten.';
  }
}
