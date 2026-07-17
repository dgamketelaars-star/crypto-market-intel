import { SYSTEM_C_MODEL_NAME, SYSTEM_C_SCHOOL } from '../metadata/provenance';
import {
  explainClose,
  explainInvalidationReason,
  explainMarketInterpretation,
  explainOpposingObservations,
  explainSetupType,
  explainSupportingObservations,
  explainTriggerCondition,
} from '../explanations/explainSystemCSetup';
import type { SystemCSetupState } from '../lifecycle/systemCLifecycle';
import type { IndependentAnalysisSetup } from './independentAnalysisSetup';

export function toIndependentAnalysisSetup(setup: SystemCSetupState): IndependentAnalysisSetup {
  const status: IndependentAnalysisSetup['status'] = setup.status;

  const supportingObservations = explainSupportingObservations(setup);
  const opposingObservations = explainOpposingObservations();
  const invalidationReason = setup.status === 'closed' || setup.status === 'invalidated' ? explainClose(setup.closedReason) : explainInvalidationReason();

  return {
    systemId: 'SYSTEM_C',
    modelName: SYSTEM_C_MODEL_NAME,
    school: SYSTEM_C_SCHOOL,
    symbol: setup.symbol,
    direction: setup.direction,
    status,
    // This baseline only runs the reasoning chain on 1h candles — a swing/liquidity read on that
    // timeframe sits closer to a day-trade horizon than a multi-day swing-trade one.
    timeframe: 'DAY_TRADE',
    marketInterpretation: explainMarketInterpretation(setup),
    setupType: explainSetupType(),
    triggerCondition: explainTriggerCondition(setup.direction),
    stopPrice: setup.stopPrice,
    targets: [{ price: setup.targetPrice, reason: setup.targetReason }],
    invalidationReason,
    supportingObservations,
    opposingObservations,
    dataTimestamp: setup.sourceDataTimestamp,
  };
}
