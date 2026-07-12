import type { MarketContextData } from './types';

export const marketContext: MarketContextData = {
  status: 'Cautious',
  btcTrend: 'Neutral',
  ethTrend: 'Slightly bullish',
  volatility: 'Elevated',
  externalRisk: 'Moderate',
  summary:
    'Bitcoin blijft stabiel, maar volatiliteit en futures-posities lopen op. Nieuwe LONG-setups vragen iets meer bevestiging.',
  details: [
    {
      label: 'BTC',
      text: 'BTC handelt al 6 dagen zijwaarts tussen $61.200 en $64.800. Geen duidelijke richting op de daggrafiek.',
    },
    {
      label: 'ETH',
      text: 'ETH doet het deze week iets beter dan BTC (+3,1% vs +0,4%). Nog geen bevestigde trendwissel.',
    },
    {
      label: 'Leverage',
      text: 'Open Interest op de belangrijkste exchanges steeg deze week met 9%. Funding blijft licht positief — geen extreme opbouw.',
    },
  ],
};
