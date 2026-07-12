import { marketContext } from '../../data/mock/marketContext';
import { useBinanceMarket } from '../../hooks/useBinanceMarket';
import { useSymbolAnalysis } from '../../hooks/useSymbolAnalysis';
import { calculateRelativeStrengthPct } from '../../analysis/derivatives/relativeStrength';
import {
  fundingStateLabels,
  oiTrendLabels,
  trendLabels,
  volatilityLabels,
} from '../../analysis/explanations/classificationLabels';
import { formatFundingRate, formatPercent } from '../../utils/format';
import type { CandleInterval } from '../../services/binance/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Disclosure } from '../ui/Disclosure';
import { TermText } from '../terms/TermText';
import { ExternalRiskMonitor } from './ExternalRiskMonitor';
import { LiveSymbolStats } from '../data-status/LiveSymbolStats';
import { CalculatedField } from '../data-status/CalculatedField';

const statusTone: Record<string, 'amber' | 'long' | 'short' | 'neutral'> = {
  Cautious: 'amber',
  Neutral: 'neutral',
  Constructive: 'long',
  'Risk-off': 'short',
};

const CONTEXT_TIMEFRAME: CandleInterval = '4h';

export function MarketContextCard() {
  const btcAnalysis = useSymbolAnalysis('BTCUSDT');
  const ethAnalysis = useSymbolAnalysis('ETHUSDT');
  const btcMarket = useBinanceMarket('BTCUSDT');
  const ethMarket = useBinanceMarket('ETHUSDT');

  const btcTrend = btcAnalysis?.timeframes[CONTEXT_TIMEFRAME]?.trend;
  const ethTrend = ethAnalysis?.timeframes[CONTEXT_TIMEFRAME]?.trend;
  const btcVolatility = btcAnalysis?.timeframes['1h']?.volatility;
  const btcPositioning = btcAnalysis?.positioning;

  const relStrength = calculateRelativeStrengthPct(
    ethMarket?.ticker?.priceChangePercent ?? null,
    btcMarket?.ticker?.priceChangePercent ?? null,
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">Market Context</h2>
        <Badge tone={statusTone[marketContext.status] ?? 'neutral'}>{marketContext.status}</Badge>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LiveSymbolStats
          symbol="BTCUSDT"
          title="BTC"
          fields={['price', 'change', 'funding', 'openInterest', 'volume']}
        />
        <LiveSymbolStats symbol="ETHUSDT" title="ETH" fields={['price', 'change']} showLastUpdate={false} />
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Calculated market read</span>
        <Badge tone="calculated" className="text-[10px]">
          Calculated
        </Badge>
      </div>
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <CalculatedField
          label="BTC trend"
          value={btcTrend ? trendLabels[btcTrend.classification] : 'Berekenen…'}
          formula="EMA20/50/200-uitlijning en -richting, plus higher-highs/lower-lows-patroon."
          timeframe={CONTEXT_TIMEFRAME}
          dataTimestamp={btcTrend?.freshness.dataTimestamp ?? null}
          explanation="De trendclassificatie kijkt naar de volgorde en richting van de voortschrijdend gemiddelden — geen voorspelling, een foto van de huidige structuur."
        />
        <CalculatedField
          label="ETH trend"
          value={ethTrend ? trendLabels[ethTrend.classification] : 'Berekenen…'}
          formula="EMA20/50/200-uitlijning en -richting, plus higher-highs/lower-lows-patroon."
          timeframe={CONTEXT_TIMEFRAME}
          dataTimestamp={ethTrend?.freshness.dataTimestamp ?? null}
          explanation="De trendclassificatie kijkt naar de volgorde en richting van de voortschrijdend gemiddelden — geen voorspelling, een foto van de huidige structuur."
        />
        <CalculatedField
          label="ETH vs BTC"
          value={relStrength !== null ? formatPercent(relStrength) : '—'}
          formula="ETH 24h%-verandering min BTC 24h%-verandering."
          timeframe="24h"
          dataTimestamp={ethMarket?.ticker?.time ?? null}
          explanation="Positief betekent dat ETH het de afgelopen 24 uur beter deed dan BTC, negatief betekent dat BTC beter deed. Zegt niets over de komende richting."
        />
        <CalculatedField
          label="BTC volatility"
          value={btcVolatility ? volatilityLabels[btcVolatility.classification] : 'Berekenen…'}
          formula="ATR(14) als % van de prijs, vergeleken met het 50-candle gemiddelde."
          timeframe="1h"
          dataTimestamp={btcVolatility?.freshness.dataTimestamp ?? null}
          explanation="Hoge volatility betekent grotere prijsuitslagen in beide richtingen, niet per se een specifieke richting."
        />
        <CalculatedField
          label="BTC funding"
          value={
            btcPositioning
              ? `${fundingStateLabels[btcPositioning.fundingState]} (${formatFundingRate(btcPositioning.fundingRate ?? undefined)})`
              : 'Berekenen…'
          }
          formula="Huidige funding vergeleken met het gemiddelde van recente eigen waarnemingen (of een vaste drempel bij weinig historie)."
          timeframe="Live + historie"
          dataTimestamp={btcPositioning?.freshness.dataTimestamp ?? null}
          explanation="Verhoogde funding betekent relatief veel long-leverage in de markt — geen garantie voor een prijsbeweging."
        />
        <CalculatedField
          label="BTC Open Interest"
          value={
            btcPositioning
              ? `${oiTrendLabels[btcPositioning.oiTrend]}${btcPositioning.oiChange4hPct !== null ? ` (${formatPercent(btcPositioning.oiChange4hPct)})` : ''}`
              : 'Berekenen…'
          }
          formula="% verandering van Open Interest over de laatste 4 uur t.o.v. de eigen geschiedenis."
          timeframe="4h"
          dataTimestamp={btcPositioning?.freshness.dataTimestamp ?? null}
          explanation="Stijgende Open Interest betekent dat er meer posities bijkomen — dat is op zichzelf niet automatisch bullish of bearish."
        />
      </dl>

      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Interpretatie</span>
        <Badge tone="neutral" className="text-[10px]">
          Mock
        </Badge>
      </div>
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">External risk</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-100">{marketContext.externalRisk}</dd>
        </div>
      </dl>

      <p className="mb-3 text-sm leading-relaxed text-slate-300">
        <TermText text={marketContext.summary} />
      </p>
      <p className="mb-3 text-xs text-slate-500">
        Status ({marketContext.status}) en de samenvatting hierboven zijn een prototype-interpretatie (mock) — nog
        niet afgeleid via een volledig gedocumenteerde deterministische regel.
      </p>

      <Disclosure label="Bekijk marktcontext" openLabel="Verberg marktcontext">
        <div className="space-y-4 pt-1">
          <ul className="space-y-2">
            {marketContext.details.map((detail) => (
              <li key={detail.label} className="flex gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs font-medium text-slate-500">{detail.label}</span>
                <span className="text-slate-300">
                  <TermText text={detail.text} />
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-800 pt-4">
            <ExternalRiskMonitor />
          </div>
        </div>
      </Disclosure>
    </Card>
  );
}
