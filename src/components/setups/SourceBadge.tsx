import { useState } from 'react';
import type { SourceRef } from '../../data/mock/types';
import { sourceCategoryDescriptions } from '../../data/mock/sourceCategories';
import { Sheet } from '../ui/Sheet';

export function SourceBadge({ source }: { source: SourceRef }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-sky-500/40 hover:text-sky-300"
      >
        {source.category}
      </button>
      <Sheet isOpen={open} onClose={() => setOpen(false)} eyebrow="Bron" title={source.category}>
        <p>{sourceCategoryDescriptions[source.category]}</p>
        <p className="rounded-md bg-slate-950/60 px-3 py-2 text-xs text-slate-400">{source.detail}</p>
        <p className="text-xs text-slate-500">Deze bron is gesimuleerd voor deze v1-preview.</p>
      </Sheet>
    </>
  );
}
