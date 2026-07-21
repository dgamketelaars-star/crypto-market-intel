import type { SetupDirection } from '../adapters/normalisedStrategySetup';
import { STOPLOSS_PCT } from '../stops/fixedStop';
import type { SystemBSetupState } from '../lifecycle/systemBLifecycle';
import { requiredRoiPctAt, TRAILING_STOP_POSITIVE } from '../targets/roiTrailing';

const BUY_LABEL = 'Supertrend (m4/p8, m7/p9, m1/p8)';
const SELL_LABEL = 'Supertrend (m1/p16, m3/p18, m6/p18)';

export function explainEntry(direction: SetupDirection): string[] {
  const label = direction === 'LONG' ? BUY_LABEL : SELL_LABEL;
  const dirWord = direction === 'LONG' ? 'omhoog (up)' : 'omlaag (down)';
  return [
    `Alle 3 onafhankelijke Supertrend-instanties (${label}) wezen op de laatste afgesloten candle dezelfde richting: ${dirWord}.`,
    'Entry is pas geldig na het sluiten van de trigger-candle — deze strategie kent geen vooraf gedefinieerde instapzone.',
  ];
}

export function explainExitMethod(): string {
  return 'Signaal-exit (middelste tegengestelde Supertrend draait om) OF tijdsafhankelijke ROI-tabel OF 5% trailing stop (actief zodra er winst is) OF vaste stop -26,5% — wat het eerst wordt geraakt.';
}

export function explainActive(setup: SystemBSetupState, now: number): string[] {
  const reasons: string[] = [];
  if (setup.entryAt !== null) {
    const elapsedMinutes = (now - setup.entryAt) / 60_000;
    const requiredRoi = requiredRoiPctAt(elapsedMinutes);
    reasons.push(`Vereiste ROI op dit moment (${elapsedMinutes.toFixed(0)} min na entry): ${(requiredRoi * 100).toFixed(1)}%.`);
    if (elapsedMinutes >= 30 && elapsedMinutes < 60) {
      reasons.push('Let op: tussen minuut 30-60 vraagt de originele ROI-tabel 75% winst — vrijwel zeker een typefout in de bron (waarschijnlijk 7,5% bedoeld), maar getrouw gereproduceerd, niet stilzwijgend gecorrigeerd.');
    }
  }
  if (setup.peakFavorablePrice !== null) {
    reasons.push(`Trailing stop volgt 5% achter de meest gunstige prijs sinds entry (${setup.peakFavorablePrice.toFixed(4)}), actief zodra er winst is.`);
  }
  reasons.push(`Vaste stop: ${(STOPLOSS_PCT * 100).toFixed(1)}% vanaf entry-prijs.`);
  return reasons;
}

export function explainClose(reason: SystemBSetupState['closedReason']): string {
  switch (reason) {
    case 'stop':
      return `Vaste stoploss (${(STOPLOSS_PCT * 100).toFixed(1)}%) geraakt.`;
    case 'trailing_stop':
      return `Trailing stop (${(TRAILING_STOP_POSITIVE * 100).toFixed(0)}% vanaf hoogste/laagste gunstige prijs) geraakt.`;
    case 'roi':
      return 'ROI-tabel doel bereikt.';
    case 'signal_exit':
      return 'Middelste tegengestelde Supertrend-instantie draaide om — signaal-exit.';
    case 'vanished':
      return 'Symbool viel uit de gevolgde Top-50 universe — tracking kon niet worden voortgezet.';
    default:
      return 'Gesloten.';
  }
}
