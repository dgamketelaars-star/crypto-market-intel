import type { SetupReasoning } from '../../data/mock/types';
import { TermText } from '../terms/TermText';

export function WhySignalSection({ reasoning }: { reasoning: SetupReasoning }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-400">Wat ondersteunt de setup?</p>
        <ul className="space-y-1">
          {reasoning.supporting.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-300">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
              <span>
                <TermText text={point} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-400">Wat spreekt tegen de setup?</p>
        <ul className="space-y-1">
          {reasoning.against.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-300">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
              <span>
                <TermText text={point} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-400">Wat moet er nu gebeuren?</p>
        <p className="text-sm text-slate-300">
          <TermText text={reasoning.nextStep} />
        </p>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-400">Wanneer verandert onze mening?</p>
        <p className="text-sm text-slate-300">
          <TermText text={reasoning.mindChange} />
        </p>
      </div>
    </div>
  );
}
