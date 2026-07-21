import type { SystemDSetupState } from '../lifecycle/systemDLifecycle';

const TRIGGER_LABEL_NL: Record<SystemDSetupState['triggerType'], string> = {
  tk_cross: 'TK-cross (Tenkan-sen kruist Kijun-sen) buiten de kumo',
  kumo_breakout: 'Kumo-breakout — prijs breekt door de cloud heen',
  kijun_bounce: 'Kijun-bounce — prijs raakte de Kijun-sen en herstelde in de trendrichting',
};

export function explainMarketInterpretation(setup: SystemDSetupState): string {
  const trendWord = setup.direction === 'LONG' ? 'boven een bullish' : 'onder een bearish';
  return `Prijs handelt ${trendWord} kumo (Senkou Span A/B), bevestigd door ${TRIGGER_LABEL_NL[setup.triggerType].toLowerCase()}. ${
    setup.chikouConfirms ? 'De Chikou Span bevestigt deze richting.' : 'De Chikou Span bevestigt deze richting niet volledig.'
  }`;
}

export function explainSetupType(setup: SystemDSetupState): string {
  return `${TRIGGER_LABEL_NL[setup.triggerType]} (Ichimoku Kinko Hyo)`;
}

export function explainTriggerCondition(setup: SystemDSetupState): string {
  return `${TRIGGER_LABEL_NL[setup.triggerType]} — entry pas geldig na het sluiten van de bevestigende candle, niet vooruitlopend op de vorming ervan.`;
}

export function explainInvalidationReason(setup: SystemDSetupState): string {
  return setup.triggerType === 'kumo_breakout'
    ? 'Stop staat aan de verre kant van de kumo die zojuist doorbroken werd — een terugval daar voorbij betekent dat de breakout mislukt is.'
    : 'Stop staat op de Kijun-sen — een sluiting terug over deze lijn ontkracht de trigger.';
}

export function explainSupportingObservations(setup: SystemDSetupState): string[] {
  const lines = [...setup.reasons];
  lines.push(`Kumo-dikte: ${setup.cloudThicknessPct.toFixed(2)}% van de prijs.`);
  lines.push(`Doel: ${setup.targetPrice.toFixed(4)} — ${setup.targetReason}`);
  return lines;
}

export function explainOpposingObservations(setup: SystemDSetupState): string[] {
  const lines = [...setup.cautions];
  lines.push('Deze combinatie van triggers en sterkte-weging is onze eigen assemblage, niet gevalideerd op historische out-of-sample data — zie provenance.ts.');
  return lines;
}

export function explainClose(reason: SystemDSetupState['closedReason']): string {
  switch (reason) {
    case 'stop':
      return 'Ichimoku-stop geraakt — de trigger werd ontkracht.';
    case 'target':
      return 'Kumo-dikte-doel bereikt.';
    case 'vanished':
      return 'Symbool viel uit de gevolgde Top-50 universe — tracking kon niet worden voortgezet.';
    default:
      return 'Gesloten.';
  }
}

export function explainExpectedDuration(setup: SystemDSetupState): string {
  return setup.triggerType === 'kumo_breakout'
    ? '1–3 dagen (gebaseerd op de Kijun-periode van 26 candles op het 1h-timeframe, de klassieke Ichimoku-verschuiving)'
    : '12–36 uur (Kijun-geankerde trigger, korter dan een volledige kumo-breakout-trade)';
}
