/**
 * System D's own normalised output shape. Modelled on the same spirit as
 * System B's NormalisedStrategySetup and System C's IndependentAnalysisSetup
 * (optional fields stay optional, nothing is invented to make systems look
 * identical), extended with the confidence and expected-duration fields
 * this system's brief specifically asked for.
 */
export type IchimokuDirection = 'LONG' | 'SHORT';

export type IchimokuStatus = 'entry_zone_now' | 'active' | 'closed' | 'invalidated';

export type IchimokuConfidence = 'strong' | 'moderate';

export interface IchimokuAnalysisSetup {
  systemId: 'SYSTEM_D';
  modelName: string;
  school: 'ichimoku';

  symbol: string;
  direction: IchimokuDirection;
  status: IchimokuStatus;
  confidence: IchimokuConfidence;
  expectedDuration: string;

  marketInterpretation: string;
  setupType: string;

  entryZone?: {
    low: number;
    high: number;
  };
  triggerCondition?: string;
  stopPrice?: number;

  targets?: Array<{
    price: number;
    reason: string;
    portion?: number;
  }>;

  invalidationReason: string;
  supportingObservations: string[];
  opposingObservations: string[];
  dataTimestamp: number;
}
