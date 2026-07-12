import { AlertTriangle } from 'lucide-react';
import { externalRiskEvents } from '../../data/mock/externalRisk';
import { TermText } from '../terms/TermText';

export function ExternalRiskMonitor() {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-400" />
        <h4 className="text-sm font-semibold text-slate-200">External Risk Monitor</h4>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Gebeurtenissen die risk-appetite of volatility de komende uren tot dagen kunnen raken — geen
        nieuwsoverzicht. Een risicofactor, nooit automatisch doorslaggevend.
      </p>
      <ul className="space-y-2">
        {externalRiskEvents.map((event) => (
          <li key={event.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium text-slate-200">{event.title}</p>
              <span className="text-xs font-medium whitespace-nowrap text-slate-500">{event.window}</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              <TermText text={event.relevance} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
