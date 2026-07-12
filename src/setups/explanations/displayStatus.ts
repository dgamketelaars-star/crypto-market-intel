import type { GeneratedSetup, SetupStatus } from '../engine/types';

/**
 * The setup engine tracks six internal statuses (candidate,
 * waiting_for_confirmation, active, invalidated, completed, expired) because
 * the lifecycle/activation-gating logic needs that granularity. Normal users
 * don't — they need to know one of four things: is this still forming, is it
 * actionable right now, am I in it, or is it done. This is a pure display
 * mapping; it never feeds back into engine decisions.
 */
export type SetupDisplayStatus = 'waiting_entry' | 'entry_zone' | 'active' | 'closed';

export function getDisplayStatus(status: SetupStatus): SetupDisplayStatus {
  switch (status) {
    case 'candidate':
      return 'waiting_entry';
    case 'waiting_for_confirmation':
      return 'entry_zone';
    case 'active':
      return 'active';
    case 'invalidated':
    case 'completed':
    case 'expired':
      return 'closed';
  }
}

export const displayStatusConfig: Record<SetupDisplayStatus, { label: string; dot: string; text: string }> = {
  waiting_entry: { label: 'Wachten op instap', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  entry_zone: { label: 'Instapzone nu', dot: 'bg-amber-400', text: 'text-amber-400' },
  active: { label: 'Positie actief', dot: 'bg-sky-400', text: 'text-sky-400' },
  closed: { label: 'Afgesloten', dot: 'bg-slate-500', text: 'text-slate-500' },
};

const closedReasonText: Record<NonNullable<GeneratedSetup['closedReason']>, string> = {
  target: 'koersdoel bereikt',
  invalidation: 'invalidation-niveau geraakt',
  expired: 'verlopen zonder bevestiging',
};

export function describeClosedReason(reason: GeneratedSetup['closedReason']): string {
  return reason ? closedReasonText[reason] : 'gesloten';
}
