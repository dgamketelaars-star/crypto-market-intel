import type { GeneratedSetup } from '../../setups/engine/types';
import { formatClockTime } from '../../utils/format';
import { Badge } from '../ui/Badge';

export function GeneratedSourcesSection({ setup }: { setup: GeneratedSetup }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge tone="calculated">Calculated</Badge>
        <p className="text-sm text-slate-300">Calculated from live Binance market data.</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-slate-500">Rule version</dt>
          <dd className="mt-0.5 font-medium text-slate-300">{setup.ruleVersion}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Origin</dt>
          <dd className="mt-0.5 font-medium text-slate-300">{setup.origin === 'live' ? 'Live' : 'Simulation'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Data-tijdstip (symbool)</dt>
          <dd className="mt-0.5 font-medium text-slate-300">{formatClockTime(setup.sourceDataTimestamps.symbol)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Data-tijdstip (BTC-context)</dt>
          <dd className="mt-0.5 font-medium text-slate-300">
            {setup.sourceDataTimestamps.btc ? formatClockTime(setup.sourceDataTimestamps.btc) : 'n.v.t.'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Aangemaakt</dt>
          <dd className="mt-0.5 font-medium text-slate-300">{formatClockTime(setup.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Laatst geëvalueerd</dt>
          <dd className="mt-0.5 font-medium text-slate-300">{formatClockTime(setup.lastEvaluatedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}
