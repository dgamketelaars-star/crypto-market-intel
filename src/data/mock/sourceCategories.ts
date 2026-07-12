import type { SourceCategory } from './types';

export const sourceCategoryDescriptions: Record<SourceCategory, string> = {
  Marktdata: 'Prijs, volume en orderboek-data van exchanges.',
  'Technische analyse': 'Patronen en niveaus afgeleid van de prijsgrafiek.',
  'On-chain data': 'Blockchain-gebaseerde signalen, zoals Open Interest en Exchange Inflow.',
  'Social data': 'Signalen uit publieke discussie en sentiment.',
  'External risk': 'Macro- en marktgebeurtenissen die risk-appetite kunnen raken.',
};
