import type { ExternalRiskEvent } from './types';

export const externalRiskEvents: ExternalRiskEvent[] = [
  {
    id: 'btc-options-expiry',
    title: 'Grote BTC-optie-expiry ($2,1B)',
    window: 'Over ~18 uur',
    relevance:
      'Grote expiries vallen vaak samen met kortstondige volatility-spikes rond de max-pain prijs. Dit is op zichzelf geen directioneel signaal.',
  },
  {
    id: 'us-cpi',
    title: 'Amerikaanse CPI-cijfers',
    window: 'Over ~2 dagen',
    relevance:
      'Hogere inflatie kan renteverwachtingen verschuiven en risk-appetite voor crypto drukken. Lager dan verwacht werkt vaak positief voor BTC en ETH.',
  },
  {
    id: 'fomc',
    title: 'FOMC-rentebesluit',
    window: 'Over ~5 dagen',
    relevance:
      'Een onverwacht besluit kan de volatility in alle risicovolle assets verhogen, inclusief crypto. Markten prijzen momenteel geen renteverandering in.',
  },
];
