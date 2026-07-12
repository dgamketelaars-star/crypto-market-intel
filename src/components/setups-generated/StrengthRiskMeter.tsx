const LEVELS = ['Low', 'Medium', 'High', 'Very high'];

const riskDotColor: Record<string, string> = {
  Low: 'bg-slate-400',
  Medium: 'bg-amber-400',
  High: 'bg-orange-500',
  'Very high': 'bg-red-600',
};

interface StrengthRiskMeterProps {
  label: string;
  level: string;
  variant: 'signal' | 'risk';
}

export function StrengthRiskMeter({ label, level, variant }: StrengthRiskMeterProps) {
  const rank = LEVELS.indexOf(level) + 1;
  const dotClass = variant === 'signal' ? 'bg-sky-400' : (riskDotColor[level] ?? 'bg-slate-400');

  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1.5 w-3 rounded-full ${i <= rank ? dotClass : 'bg-slate-700'}`} />
          ))}
        </div>
        <span className="text-xs font-medium text-slate-300">{level}</span>
      </div>
    </div>
  );
}
