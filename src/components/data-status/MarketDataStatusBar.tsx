import { useState, useSyncExternalStore } from 'react';
import { useMarketConnection } from '../../hooks/useMarketConnection';
import { formatClockTime } from '../../utils/format';
import { Sheet } from '../ui/Sheet';
import { marketDataStore } from '../../store/marketDataStore';
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
  const [universeOpen, setUniverseOpen] = useState(false);
  const cfg = stateConfig[connection];
  const universeCount = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().universe.length);
  const universeRefreshedAt = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().lastRestSyncAt);

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
        <button type="button" onClick={() => setUniverseOpen(true)} className="flex items-center gap-1.5 text-slate-400 hover:text-sky-300">
          <span className="text-slate-500">Universe</span>
          <span className="font-medium text-sky-400 underline decoration-sky-400/40 decoration-dotted underline-offset-2">
            {universeCount || '—'} symbolen (A-D)
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

      <Sheet isOpen={universeOpen} onClose={() => setUniverseOpen(false)} eyebrow="Gedeeld marktuniversum" title={`${universeCount || '—'} symbolen`}>
        <p>
          Systemen A, B, C en D scannen allemaal exact dezelfde, dynamisch samengestelde lijst van (nominaal) 50 Binance USDⓈ-M Futures-symbolen — één
          gedeelde bron, geen aparte selectie per systeem.
        </p>
        <p className="text-xs text-slate-500">
          Selectiegrondslag: 24-uurs quote-volume/liquiditeit (niet prijsstijging of market cap), met een minimale liquiditeitsdrempel en uitsluiting van
          net-genoteerde en leveraged-token-achtige instrumenten. BTCUSDT en ETHUSDT zijn altijd opgenomen. Een kleine hysteresebuffer voorkomt dat
          symbolen rond de grens steeds in en uit de lijst wisselen — de lijst kan daardoor incidenteel iets boven 50 symbolen uitkomen.
        </p>
        <p className="text-xs text-slate-500">Laatst vernieuwd: {universeRefreshedAt ? formatClockTime(universeRefreshedAt) : 'nog niet'} (elke 5 minuten).</p>
      </Sheet>
    </div>
  );
}
