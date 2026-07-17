import { SYSTEM_D_MODEL_NAME } from '../metadata/provenance';
import {
  explainClose,
  explainExpectedDuration,
  explainInvalidationReason,
  explainMarketInterpretation,
  explainOpposingObservations,
  explainSetupType,
  explainSupportingObservations,
  explainTriggerCondition,
} from '../explanations/explainSystemDSetup';
import type { SystemDSetupState } from '../lifecycle/systemDLifecycle';
import type { IchimokuAnalysisSetup } from './ichimokuAnalysisSetup';

/** Own choice: a narrow band around the trigger close, since Ichimoku triggers (TK cross, kumo breakout, kijun bounce) are candle-close events, not a pre-formed wide entry zone. */
const ENTRY_ZONE_PCT = 0.001;

export function toIchimokuAnalysisSetup(setup: SystemDSetupState): IchimokuAnalysisSetup {
  const supportingObservations = explainSupportingObservations(setup);
  const opposingObservations = explainOpposingObservations(setup);
  const invalidationReason = setup.status === 'closed' || setup.status === 'invalidated' ? explainClose(setup.closedReason) : explainInvalidationReason(setup);

  return {
    systemId: 'SYSTEM_D',
    modelName: SYSTEM_D_MODEL_NAME,
    school: 'ichimoku',
    symbol: setup.symbol,
    direction: setup.direction,
    status: setup.status,
    confidence: setup.strength,
    expectedDuration: explainExpectedDuration(setup),
    marketInterpretation: explainMarketInterpretation(setup),
    setupType: explainSetupType(setup),
    entryZone: { low: setup.entryPrice * (1 - ENTRY_ZONE_PCT), high: setup.entryPrice * (1 + ENTRY_ZONE_PCT) },
    triggerCondition: explainTriggerCondition(setup),
    stopPrice: setup.stopPrice,
    targets: [{ price: setup.targetPrice, reason: setup.targetReason }],
    invalidationReason,
    supportingObservations,
    opposingObservations,
    dataTimestamp: setup.sourceDataTimestamp,
  };
}
