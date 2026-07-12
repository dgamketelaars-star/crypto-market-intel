import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface DisclosureProps {
  label: string;
  openLabel?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Disclosure({ label, openLabel, children, defaultOpen = false }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-slate-800 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-3 text-left text-sm font-medium text-slate-200 hover:text-slate-50"
      >
        <span>{open && openLabel ? openLabel : label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}
