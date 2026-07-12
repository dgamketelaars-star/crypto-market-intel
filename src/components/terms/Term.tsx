import { useState } from 'react';
import { glossary } from '../../data/mock/glossary';
import { Sheet } from '../ui/Sheet';

interface TermProps {
  termKey: string;
  label?: string;
}

export function Term({ termKey, label }: TermProps) {
  const [open, setOpen] = useState(false);
  const entry = glossary[termKey];

  if (!entry) return <>{label ?? termKey}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm font-medium text-sky-400 underline decoration-sky-400/40 decoration-dotted underline-offset-2 transition-colors hover:text-sky-300 hover:decoration-sky-300"
      >
        {label ?? termKey}
      </button>
      <Sheet isOpen={open} onClose={() => setOpen(false)} eyebrow="Vakterm" title={entry.term}>
        <p>{entry.definition}</p>
      </Sheet>
    </>
  );
}
