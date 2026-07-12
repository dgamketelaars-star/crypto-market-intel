import { useState } from 'react';
import type { AttentionExplanation, AttentionLevel } from '../../analysis/engine/types';
import { attentionLabels } from '../../analysis/explanations/classificationLabels';
import { WhyThisStandsOutSheet } from './WhyThisStandsOutSheet';

const toneClasses: Record<AttentionLevel, string> = {
  normal: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/25',
  worth_watching: 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/25',
  unusual_activity: 'bg-orange-500/10 text-orange-400 ring-1 ring-inset ring-orange-500/25',
  insufficient_data: 'bg-slate-800 text-slate-500 ring-1 ring-inset ring-slate-700',
};

interface AttentionBadgeProps {
  symbol: string;
  level: AttentionLevel;
  explanation: AttentionExplanation;
}

export function AttentionBadge({ symbol, level, explanation }: AttentionBadgeProps) {
  const [open, setOpen] = useState(false);
  const clickable = level !== 'insufficient_data';

  return (
    <>
      <button
        type="button"
        disabled={!clickable}
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${toneClasses[level]} ${
          clickable ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
        }`}
      >
        {attentionLabels[level]}
      </button>
      {clickable && (
        <WhyThisStandsOutSheet isOpen={open} onClose={() => setOpen(false)} symbol={symbol} explanation={explanation} />
      )}
    </>
  );
}
