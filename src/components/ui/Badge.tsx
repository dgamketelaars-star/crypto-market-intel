import type { ReactNode } from 'react';

export type BadgeTone = 'long' | 'short' | 'neutral' | 'amber' | 'orange' | 'accent' | 'calculated';

const toneClasses: Record<BadgeTone, string> = {
  long: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/25',
  short: 'bg-rose-500/10 text-rose-400 ring-1 ring-inset ring-rose-500/25',
  neutral: 'bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/25',
  amber: 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/25',
  orange: 'bg-orange-500/10 text-orange-400 ring-1 ring-inset ring-orange-500/25',
  accent: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/25',
  calculated: 'bg-violet-500/10 text-violet-400 ring-1 ring-inset ring-violet-500/25',
};

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
