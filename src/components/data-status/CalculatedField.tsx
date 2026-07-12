import { useState } from 'react';
import { formatClockTime } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Sheet } from '../ui/Sheet';

interface CalculatedFieldProps {
  label: string;
  value: string;
  formula: string;
  timeframe: string;
  dataTimestamp: number | null;
  explanation: string;
}

export function CalculatedField({ label, value, formula, timeframe, dataTimestamp, explanation }: CalculatedFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group text-left">
        <p className="flex items-center gap-1.5 text-xs text-slate-500 group-hover:text-slate-400">
          {label}
          <Badge tone="calculated" className="px-1 py-0 text-[9px] leading-4">
            C
          </Badge>
        </p>
        <p className="mt-0.5 text-sm font-medium text-slate-100 underline decoration-slate-700 decoration-dotted underline-offset-4 group-hover:decoration-slate-500">
          {value}
        </p>
      </button>
      <Sheet isOpen={open} onClose={() => setOpen(false)} eyebrow="Calculated" title={label}>
        <p>{explanation}</p>
        <div className="space-y-1 rounded-md bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
          <p>
            <span className="text-slate-500">Regel/formule:</span> {formula}
          </p>
          <p>
            <span className="text-slate-500">Timeframe:</span> {timeframe}
          </p>
          <p>
            <span className="text-slate-500">Data-tijdstip:</span> {formatClockTime(dataTimestamp)}
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Berekend uit live/historische Binance-data — geen trading-signaal.
        </p>
      </Sheet>
    </>
  );
}
