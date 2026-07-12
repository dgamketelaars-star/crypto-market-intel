export interface GlossaryTerm {
  term: string;
  definition: string;
}

export const glossary: Record<string, GlossaryTerm> = {
  'Open Interest': {
    term: 'Open Interest',
    definition:
      'Het totale aantal futures-posities dat nog openstaat. Een snelle stijging betekent dat er meer geld en vaak meer leverage de markt in komt. Het zegt niet automatisch welke kant de prijs op gaat.',
  },
  Volume: {
    term: 'Volume',
    definition:
      'Het totale bedrag dat in een bepaalde periode is verhandeld. Hoog volume bij een prijsbeweging betekent dat er echte overtuiging achter zit. Bewegingen op laag volume zijn makkelijker om te draaien.',
  },
  'Exchange Inflow': {
    term: 'Exchange Inflow',
    definition:
      'De hoeveelheid coins die van wallets naar exchanges wordt gestuurd. Een stijging kan betekenen dat mensen zich voorbereiden om te verkopen. Het is een signaal, geen garantie — coins bewegen ook om andere redenen.',
  },
  Breakout: {
    term: 'Breakout',
    definition:
      'Het moment waarop de prijs door een belangrijk niveau breekt, zoals een Resistance-zone. Een geldige breakout wordt meestal bevestigd door hoger volume. Zonder die bevestiging is de kans op een valse uitbraak groter.',
  },
  Trigger: {
    term: 'Trigger',
    definition:
      'Het exacte punt waarop een setup pas geldig wordt. Pas als de prijs dit niveau bereikt en bevestigt, is de kans die de analyse beschrijft daadwerkelijk van toepassing.',
  },
  Invalidation: {
    term: 'Invalidation',
    definition:
      'Het niveau waarop de redenering achter de setup niet meer klopt. Gaat de prijs hierdoorheen, dan vervalt de setup — ongeacht wat daarvoor gebeurde.',
  },
  Volatility: {
    term: 'Volatility',
    definition:
      'Hoe sterk en hoe snel de prijs beweegt. Hoge volatility betekent grotere kansen, maar ook grotere risico’s en snellere invalidaties.',
  },
  Funding: {
    term: 'Funding',
    definition:
      'Een periodieke betaling tussen long- en short-posities in futures. Positieve funding betekent dat longs betalen aan shorts — een teken dat er relatief veel long-leverage in de markt zit.',
  },
  Resistance: {
    term: 'Resistance',
    definition:
      'Een prijsniveau waar verkoopdruk historisch sterk genoeg was om de prijs tegen te houden. Wordt dit niveau met overtuiging doorbroken, dan spreken we van een Breakout.',
  },
  'Attention Level': {
    term: 'Attention Level',
    definition:
      'Een label dat aangeeft hoeveel objectieve marktkenmerken (zoals volume, volatility of Open Interest) tegelijk afwijken van normaal. Het is geen trading-signaal en zegt niets over de richting van de prijs — alleen dat een symbool het bekijken waard is.',
  },
};

export const glossaryKeys = Object.keys(glossary).sort((a, b) => b.length - a.length);
