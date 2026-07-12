import type { LifecycleEventType, SetupLifecycleEvent } from '../../setups/engine/types';
import { formatClockTime } from '../../utils/format';

const eventDotColor: Record<LifecycleEventType, string> = {
  candidate_created: 'bg-slate-400',
  trigger_approached: 'bg-amber-400',
  confirmation_received: 'bg-sky-400',
  setup_activated: 'bg-emerald-400',
  strength_changed: 'bg-violet-400',
  risk_changed: 'bg-violet-400',
  context_adjustment: 'bg-amber-400',
  target_reached: 'bg-emerald-400',
  setup_invalidated: 'bg-rose-400',
  setup_completed: 'bg-emerald-400',
  setup_expired: 'bg-slate-500',
};

export function LifecycleHistoryList({ events }: { events: SetupLifecycleEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-slate-500">Nog geen lifecycle-events.</p>;
  }
  return (
    <ol className="space-y-2.5">
      {events.map((event, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${eventDotColor[event.type]}`} />
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-slate-500">{formatClockTime(event.timestamp)}</span>
              <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {event.type.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-slate-300">{event.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
