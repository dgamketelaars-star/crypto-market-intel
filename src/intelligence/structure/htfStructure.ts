import type { Candle } from '../../services/binance/types';
import { blockedGate, fact, layerAGate } from '../evidence/build';
import type { LayerACategoryEvidence } from '../evidence/types';
import { detectStructureEvent, type StructureEvent } from './structureEvents';

function eventBias(event: StructureEvent): 'bullish' | 'bearish' | 'neutral' {
  if (event === 'bullish_bos' || event === 'bullish_choch') return 'bullish';
  if (event === 'bearish_bos' || event === 'bearish_choch') return 'bearish';
  return 'neutral';
}

/**
 * Layer A hard gate on higher-timeframe structure: usable only when at
 * least one of 4H/1D has enough swing history to read, and the two don't
 * directly contradict each other (one bullish event, the other bearish).
 * "None" (no active break/reversal event right now) is a perfectly usable,
 * neutral-bias read — it just means there's no fresh structural event to
 * lean on; it does not block the gate.
 */
export function evaluateHtfStructure(candles4h: Candle[], candles1d: Candle[], sourceTimestamp: number): LayerACategoryEvidence {
  const event4h = detectStructureEvent(candles4h);
  const event1d = detectStructureEvent(candles1d);
  const sufficient4h = event4h.event !== 'insufficient_data';
  const sufficient1d = event1d.event !== 'insufficient_data';

  if (!sufficient4h && !sufficient1d) {
    return blockedGate('higher_timeframe_structure', 'multi', sourceTimestamp, 'Insufficient swing history on both 4H and 1D to read structure.');
  }

  const bias4h = sufficient4h ? eventBias(event4h.event) : 'neutral';
  const bias1d = sufficient1d ? eventBias(event1d.event) : 'neutral';

  if (sufficient4h && sufficient1d && bias4h !== 'neutral' && bias1d !== 'neutral' && bias4h !== bias1d) {
    return blockedGate(
      'higher_timeframe_structure',
      'multi',
      sourceTimestamp,
      `4H structure (${event4h.event}) and 1D structure (${event1d.event}) directly conflict.`,
    );
  }

  // 1D leads (the slower, higher-conviction read); 4H fills in when 1D has no fresh event.
  const leadEvent = sufficient1d && bias1d !== 'neutral' ? event1d : sufficient4h ? event4h : event1d;
  const bias = sufficient1d && bias1d !== 'neutral' ? bias1d : sufficient4h ? bias4h : bias1d;
  const supportTimeframe = sufficient1d && bias1d !== 'neutral' ? '1d' : sufficient4h ? '4h' : '1d';

  const supporting =
    leadEvent.event === 'none'
      ? []
      : [fact(`${supportTimeframe.toUpperCase()} structure event: ${leadEvent.event} at ${leadEvent.brokenLevel?.price ?? 'n/a'}.`, supportTimeframe, sourceTimestamp)];

  return layerAGate({
    category: 'higher_timeframe_structure',
    gateStatus: 'usable',
    bias,
    conclusion: bias === 'bullish' ? 'bullish' : bias === 'bearish' ? 'bearish' : 'neutral',
    supporting,
    timeframe: supportTimeframe,
    sourceTimestamp,
  });
}
