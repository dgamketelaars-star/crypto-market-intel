import type { Setup } from '../../data/mock/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Disclosure } from '../ui/Disclosure';
import { Term } from '../terms/Term';
import { TermText } from '../terms/TermText';
import { Meter } from './Meter';
import { WhySignalSection } from './WhySignalSection';
import { TechnicalDetailsSection } from './TechnicalDetailsSection';
import { SourcesSection } from './SourcesSection';
import { LiveSymbolStats } from '../data-status/LiveSymbolStats';

const signalTone: Record<Setup['signal'], 'long' | 'short' | 'neutral'> = {
  'Strong Buy': 'long',
  Buy: 'long',
  Watch: 'neutral',
  Sell: 'short',
  'Strong Sell': 'short',
};

const statusStyle: Record<Setup['status'], { dot: string; text: string }> = {
  Active: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  'Waiting for confirmation': { dot: 'bg-amber-400', text: 'text-amber-400' },
  Invalidated: { dot: 'bg-slate-500', text: 'text-slate-500' },
  Closed: { dot: 'bg-slate-500', text: 'text-slate-500' },
};

export function SetupCard({ setup }: { setup: Setup }) {
  const status = statusStyle[setup.status];

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-lg font-semibold text-slate-100">{setup.pair}</h3>
          <Badge tone={setup.direction === 'LONG' ? 'long' : 'short'}>{setup.direction}</Badge>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          <span className={`text-xs font-medium whitespace-nowrap ${status.text}`}>{setup.status}</span>
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-sky-400 uppercase">Live market data</p>
        <LiveSymbolStats symbol={setup.pair} fields={['price', 'change', 'funding', 'openInterest']} />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="h-px flex-1 bg-slate-800" />
        <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Prototype analysis · mock
        </span>
        <span className="h-px flex-1 bg-slate-800" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Badge tone={signalTone[setup.signal]} className="text-sm">
          {setup.signal}
        </Badge>
        <Meter label="Signal strength" level={setup.signalStrength} variant="signal" />
        <Meter label="Risk" level={setup.risk} variant="risk" />
      </div>

      <p className="mb-4 text-sm leading-relaxed text-slate-300">
        <TermText text={setup.summary} />
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {setup.keyFacts.map((fact) => (
          <span
            key={fact.label}
            className="rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1 text-xs text-slate-300"
          >
            <TermText text={fact.label} />
          </span>
        ))}
      </div>

      <dl className="mb-1 grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <div>
          <dt className="text-xs text-slate-500">
            <Term termKey="Trigger" />
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-100">{setup.trigger}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">
            <Term termKey="Invalidation" />
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-100">{setup.invalidation}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Verwachte duur</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-100">{setup.expectedDuration}</dd>
        </div>
      </dl>

      {(setup.entryZone || setup.targets) && (
        <dl className="mb-4 grid grid-cols-2 gap-3 px-3 pt-3">
          {setup.entryZone && (
            <div>
              <dt className="text-xs text-slate-500">Entry zone</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-100">{setup.entryZone}</dd>
            </div>
          )}
          {setup.targets && (
            <div>
              <dt className="text-xs text-slate-500">Targets</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-100">{setup.targets.join(' · ')}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-2">
        <Disclosure label="Waarom dit signaal?">
          <WhySignalSection reasoning={setup.reasoning} />
        </Disclosure>
        <Disclosure label="Technische details">
          <TechnicalDetailsSection details={setup.technicalDetails} />
        </Disclosure>
        <Disclosure label="Bronnen">
          <SourcesSection sources={setup.sources} />
        </Disclosure>
      </div>
    </Card>
  );
}
