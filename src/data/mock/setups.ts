import type { Setup } from './types';

export const setups: Setup[] = [
  {
    id: 'solusdt-long',
    pair: 'SOLUSDT',
    direction: 'LONG',
    signal: 'Strong Buy',
    signalStrength: 'High',
    risk: 'Medium',
    expectedDuration: '1–3 dagen',
    status: 'Active',
    keyFacts: [
      { label: 'Breakout confirmed' },
      { label: 'Volume +42%' },
      { label: 'Open Interest +11%' },
      { label: 'BTC stable' },
    ],
    summary:
      'SOL is door een belangrijk prijsniveau gebroken. Volume en Open Interest bevestigen de beweging, terwijl Bitcoin stabiel blijft.',
    trigger: '4H close boven $148.20',
    invalidation: '4H close onder $143.80',
    entryZone: '$147.80 – $149.20',
    targets: ['$154.00', '$159.50'],
    reasoning: {
      supporting: [
        'Prijs sloot boven $148.20 op de 4H-chart — bevestigde Breakout.',
        'Volume ligt 42% boven het gemiddelde en onderbouwt de beweging.',
        'Open Interest steeg 11% — er komen nieuwe posities bij, niet alleen shorts die sluiten.',
        'BTC blijft stabiel, dus geen tegenwind vanuit de marktleider.',
      ],
      against: [
        'Nog geen bevestiging op de hogere 1D-timeframe.',
        'Volatility in de bredere markt is verhoogd, bewegingen kunnen sneller omslaan.',
        'De Resistance rond $154.00 is nog niet getest.',
      ],
      nextStep:
        'Bevestiging blijft of de zone $147.80–$149.20 als support standhoudt op de volgende 4H-candles.',
      mindChange: 'Als de 4H-candle sluit onder $143.80, vervalt deze setup.',
    },
    technicalDetails: [
      { label: 'Timeframe', value: '4H' },
      { label: 'Structuur', value: 'Breakout boven meerdaagse Resistance-zone ($146.50–$148.20)' },
      { label: 'Volume (24u)', value: '+42% t.o.v. gemiddelde' },
      { label: 'Open Interest (24u)', value: '+11%' },
      { label: 'Funding', value: 'Licht positief, geen extreme opbouw' },
      { label: 'RSI (4H)', value: '62 — opwaarts, nog niet overbought' },
    ],
    sources: [
      { category: 'Marktdata', detail: 'Binance Futures (mockdata)' },
      { category: 'Technische analyse', detail: 'Intern prijs- en volumemodel (mockdata)' },
      { category: 'On-chain data', detail: 'Mock on-chain feed — Open Interest & Exchange Inflow' },
    ],
  },
  {
    id: 'dogeusdt-short',
    pair: 'DOGEUSDT',
    direction: 'SHORT',
    signal: 'Watch',
    signalStrength: 'Medium',
    risk: 'High',
    expectedDuration: '12–36 uur',
    status: 'Waiting for confirmation',
    keyFacts: [
      { label: 'Price still rising' },
      { label: 'Buying volume weakening' },
      { label: 'Open Interest +18%' },
      { label: 'Exchange inflow +31%' },
    ],
    summary:
      'De prijs stijgt nog, maar koopdruk neemt af terwijl leverage en exchange inflow oplopen. Dat maakt de beweging kwetsbaar.',
    trigger: '1H close onder $0.214',
    invalidation: '1H close boven $0.226',
    reasoning: {
      supporting: [
        'Koopvolume neemt af terwijl de prijs nog stijgt — klassiek teken van verzwakkende druk.',
        'Open Interest steeg 18% — veel nieuwe leverage komt erbij tegen stijgende prijzen.',
        'Exchange Inflow steeg 31% — vaak een voorbereiding op verkoop.',
      ],
      against: [
        'De prijs is nog niet gedraaid — de Trigger is nog niet geraakt.',
        'Breed marktsentiment kan de stijging nog even doortrekken.',
        'Geen bevestiging vanuit BTC-zwakte.',
      ],
      nextStep: 'Wachten op een 1H-candle close onder $0.214 voordat de SHORT wordt bevestigd.',
      mindChange: 'Als de 1H-candle sluit boven $0.226, vervalt deze setup.',
    },
    technicalDetails: [
      { label: 'Timeframe', value: '1H' },
      { label: 'Structuur', value: 'Nieuwe hoogte gezet, momentum-divergentie zichtbaar' },
      { label: 'Buying volume', value: 'Neemt af t.o.v. prijsstijging' },
      { label: 'Open Interest (24u)', value: '+18%' },
      { label: 'Exchange Inflow (24u)', value: '+31%' },
      { label: 'Funding', value: 'Positief en oplopend — long-leverage neemt toe' },
    ],
    sources: [
      { category: 'Marktdata', detail: 'Binance Futures (mockdata)' },
      { category: 'Technische analyse', detail: 'Intern prijs- en volumemodel (mockdata)' },
      { category: 'On-chain data', detail: 'Mock on-chain feed — Open Interest & Exchange Inflow' },
      { category: 'Social data', detail: 'Mock social-sentimentfeed' },
    ],
  },
];
