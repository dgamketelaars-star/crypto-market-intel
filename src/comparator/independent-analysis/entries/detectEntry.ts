import { detectLiquiditySweepReversal, type LiquiditySweepCandle, type SmcReversalSignal } from '../signals/liquiditySweepReversal';

/** Entry only becomes valid after the confirming structure break closes — this school has no pre-entry zone either. */
export function detectEntry(candles: LiquiditySweepCandle[]): SmcReversalSignal | null {
  return detectLiquiditySweepReversal(candles);
}
