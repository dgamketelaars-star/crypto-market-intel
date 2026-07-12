import type { TechnicalDetail } from '../../data/mock/types';
import { TermText } from '../terms/TermText';

export function TechnicalDetailsSection({ details }: { details: TechnicalDetail[] }) {
  return (
    <dl className="space-y-2">
      {details.map((detail) => (
        <div key={detail.label} className="flex justify-between gap-4 text-sm">
          <dt className="shrink-0 text-slate-500">{detail.label}</dt>
          <dd className="text-right text-slate-300">
            <TermText text={detail.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
