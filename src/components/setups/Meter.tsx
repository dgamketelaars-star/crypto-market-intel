import type { Level } from '../../data/mock/types';

const levelRank: Record<Level, number> = { Low: 1, Medium: 2, High: 3 };

const riskDotColor: Record<Level, string> = {
  Low: 'bg-slate-400',
  Medium: 'bg-amber-400',
  High: 'bg-orange-500',
};

interface MeterProps {
  label: string;
  level: Level;
  variant: 'signal' | 'risk';
}

export function Meter({ label, level, variant }: MeterProps) {
  const rank = levelRank[level];
  const dotClass = variant === 'signal' ? 'bg-sky-400' : riskDotColor[level];

  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-4 rounded-full ${i <= rank ? dotClass : 'bg-slate-700'}`}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-slate-300">{level}</span>
      </div>
    </div>
  );
}
