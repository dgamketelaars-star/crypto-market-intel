import type { GeneratedSetup } from '../../setups/engine/types';
import { formatUsdPrice } from '../../utils/format';
import { TermText } from '../terms/TermText';

function EvidenceList({ title, items, dotClassName }: { title: string; items: GeneratedSetup['supporting']; dotClassName: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-400">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={`${item.group}-${item.label}`} className="flex gap-2 text-sm text-slate-300">
            <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${dotClassName}`} />
            <span>
              <span className="font-medium text-slate-200">{item.label}.</span> <TermText text={item.detail} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GeneratedWhySection({ setup }: { setup: GeneratedSetup }) {
  return (
    <div className="space-y-4">
      <EvidenceList title="Wat ondersteunt de setup?" items={setup.supporting} dotClassName="bg-emerald-400" />
      <EvidenceList title="Wat spreekt tegen de setup?" items={setup.opposing} dotClassName="bg-rose-400" />
      <EvidenceList title="Ontbrekende data" items={setup.missingData} dotClassName="bg-slate-500" />
      {setup.directionRejection && (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-400">
            Waarom niet {setup.directionRejection.rejectedDirection}?
          </p>
          <p className="text-sm text-slate-300">
            <TermText text={setup.directionRejection.reason} />
          </p>
        </div>
      )}
      {setup.marketContext.applied && (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-400">BTC-contextaanpassing</p>
          <p className="text-sm text-slate-300">
            <TermText text={setup.marketContext.reason} />
          </p>
        </div>
      )}
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-400">Wat moet er nu gebeuren?</p>
        <p className="text-sm text-slate-300">
          {setup.status === 'candidate' &&
            'Prijs moet dichter bij het triggerniveau komen en de resterende bevestigingsvoorwaarden moeten vervuld raken.'}
          {setup.status === 'waiting_for_confirmation' &&
            'Prijs staat al dicht bij of voorbij de trigger — een bevestigende candle-close is nog nodig.'}
          {setup.status === 'active' && 'Setup is actief — koers wordt gevolgd tegen het vaste invalidation- en targetniveau.'}
          {(setup.status === 'invalidated' || setup.status === 'completed' || setup.status === 'expired') &&
            'Deze setup is gesloten — zie de lifecycle-geschiedenis hieronder voor het volledige verloop.'}
        </p>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-400">Wanneer verandert onze mening?</p>
        <p className="text-sm text-slate-300">
          Als de prijs {formatUsdPrice(setup.invalidation.price)} bereikt ({setup.invalidation.explanation.toLowerCase()})
        </p>
      </div>
    </div>
  );
}
