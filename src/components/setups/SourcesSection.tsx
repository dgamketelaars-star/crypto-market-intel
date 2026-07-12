import type { SourceRef } from '../../data/mock/types';
import { SourceBadge } from './SourceBadge';

export function SourcesSection({ sources }: { sources: SourceRef[] }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <SourceBadge key={source.category} source={source} />
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        V1 gebruikt mockdata ter illustratie — nog geen live databronnen.
      </p>
    </div>
  );
}
