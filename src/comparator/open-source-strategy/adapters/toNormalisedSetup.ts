import type { SystemBSetupState } from '../lifecycle/systemBLifecycle';
import { explainActive, explainClose, explainEntry, explainExitMethod } from '../explanations/explainSystemBSetup';
import { SYSTEM_B_ID } from '../metadata/provenance';
import type { NormalisedStrategySetup } from './normalisedStrategySetup';

const STRATEGY_VERSION = 'freqtrade/freqtrade-strategies @ b8a90be';

export function toNormalisedStrategySetup(setup: SystemBSetupState, now: number): NormalisedStrategySetup {
  const status: NormalisedStrategySetup['status'] =
    setup.status === 'entry_triggered' ? 'entry_triggered' : setup.status === 'active' ? 'active' : setup.status === 'invalidated' ? 'invalidated' : 'closed';

  const reasonSummary: string[] = [...explainEntry(setup.direction)];
  if (setup.status === 'active') reasonSummary.push(...explainActive(setup, now));
  if (setup.status === 'closed' || setup.status === 'invalidated') reasonSummary.push(explainClose(setup.closedReason));

  return {
    systemId: SYSTEM_B_ID,
    symbol: setup.symbol,
    direction: setup.direction,
    strategyName: 'FSupertrendStrategy',
    strategyVersion: STRATEGY_VERSION,
    status,
    detectedAt: setup.createdAt,
    triggerPrice: setup.triggerPrice,
    stopPrice: setup.stopPrice,
    // No fixed price targets exist upstream (ROI is %-based and time-decaying, trailing is dynamic) —
    // left undefined rather than fabricated, per the comparator spec.
    targets: undefined,
    exitMethod: explainExitMethod(),
    reasonSummary,
    sourceDataTimestamp: setup.sourceDataTimestamp,
  };
}
