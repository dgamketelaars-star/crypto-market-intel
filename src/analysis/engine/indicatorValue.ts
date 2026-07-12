import type { CandleInterval } from '../../services/binance/types';
import type { IndicatorValue } from './types';

export function makeIndicatorValue<T>(
  value: T,
  timeframe: CandleInterval,
  sufficientData: boolean,
  dataTimestamp: number,
  calculatedAt: number,
): IndicatorValue<T> {
  return { value, timeframe, sufficientData, dataTimestamp, calculatedAt };
}
