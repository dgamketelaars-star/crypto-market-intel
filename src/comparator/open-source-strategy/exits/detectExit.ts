import type { SetupDirection } from '../adapters/normalisedStrategySetup';
import type { TripleConfirmationPoint } from '../signals/tripleConfirmation';

/** Upstream `populate_exit_trend`: exit_long / exit_short columns, mirrored here. */
export function detectSignalExit(point: TripleConfirmationPoint, direction: SetupDirection): boolean {
  return direction === 'LONG' ? point.exitLong : point.exitShort;
}
