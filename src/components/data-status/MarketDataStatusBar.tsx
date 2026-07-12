import { useState } from 'react';
import { useMarketConnection } from '../../hooks/useMarketConnection';
import { formatClockTime } from '../../utils/format';
import { Sheet } from '../ui/Sheet';
import type { ConnectionState } from '../../services/binance/types';

const stateConfig: Record<ConnectionState, { label: string; dot: string; text: string; pulse?: boolean }> = {
  live: { label: 'Live', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-amber-400', text: 'text-amber-400', pulse: true },
  delayed: { label: 'Delayed', dot: 'bg-amber-400', text: 'text-amber-400' },
  offline: { label: 'Offline', dot: 'bg-rose-400', text: 'text-rose-400' },
};

export function MarketDataStatusBar() {
  const { connection, lastUpdatedAt, error } = useMarketConnection();
  const [sourceOpen, setSourceOpen] = useState(false);
  const cfg = stateConfig[connection];

  return (
    <div className="border-b border-slate-800 bg-slate-950/60">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-1.5 px-4 py-2 text-xs sm:px-6">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Market data</span>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
          <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Last update</span>
          <span className="font-medium text-slate-300">{formatClockTime(lastUpdatedAt)}</span>
        </div>
        <button
          type="button"
          onClick={() => setSourceOpen(true)}
          className="flex items-center gap-1.5 text-slate-400 hover:text-sky-300"
        >
          <span className="text-slate-500">Source</span>
          <span className="font-medium text-sky-400 underline decoration-sky-400/40 decoration-dotted underline-offset-2">
            Binance USDⓈ-M Futures
          </span>
        </button>
        {error && connection !== 'live' && <span className="text-rose-400/80">{error}</span>}
      </div>

      <Sheet isOpen={sourceOpen} onClose={() => setSourceOpen(false)} eyebrow="Bron" title="Binance USDⓈ-M Futures">
        <p>Publieke futures-marketdata rechtstreeks van Binance. Geen account- of tradingtoegang.</p>
        <p className="text-xs text-slate-500">
          REST voor initial load en historische candles, WebSocket voor live prijs-, candle- en mark price-updates.
          Geen API-key of authenticatie vereist voor deze publieke endpoints.
        </p>
      </Sheet>
    </div>
  );
}
