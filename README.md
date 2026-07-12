# Market Intel

A deterministic, rule-based crypto market intelligence dashboard built on live Binance USDⓈ-M Futures data. No backend, no LLM, no social/news feeds, no wallet or trade-execution integration — everything is computed client-side from public market data.

**Live:** https://dgamketelaars-star.github.io/crypto-market-intel/

## What it does

- Streams live price, funding, open interest and candle data for the Top-20 USDⓈ-M Futures symbols (plus BTC and ETH) directly from Binance's public REST/WebSocket API.
- Runs a layered intelligence pipeline (`src/intelligence/`) that reads market regime → higher-timeframe structure → trend/momentum/volume confirmation → volatility/derivatives/BTC-ETH context, and only then forms a coherent LONG/SHORT thesis — or explicitly concludes **no thesis** rather than forcing one.
- Builds structure-first entry zones, stoplosses and targets from a valid thesis (never an arbitrary price-plus-ATR shortcut), classifies day-trade vs. swing-trade horizon as an input to planning (not a result of it), and computes an independent Signal Strength and Risk rating.
- Tracks published setups through a full lifecycle (candidate → active → invalidated/completed/expired) and persists them locally in the browser.

Nothing here is a trading signal or financial advice — it's a transparent, explainable read of public market structure.

## Architecture

- `src/services/binance/` — REST + WebSocket client for Binance USDⓈ-M Futures public endpoints.
- `src/store/`, `src/analysis/` — live market-data store and the underlying indicator/structure calculations.
- `src/intelligence/` — the evidence-synthesis and thesis-decision pipeline: regime classification, market structure (BOS/CHOCH/retest), trend/momentum/volume/volatility/derivatives/market-context evidence categories, the LONG/SHORT/NO-THESIS decision flow, and structure-first trade planning.
- `src/setups/` — setup lifecycle state machine, persistence, and UI-facing types.
- `src/components/` — the dashboard UI.

## Local development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite
npm run build    # typecheck + production build
npm run lint      # oxlint
```

Deployment to GitHub Pages happens automatically via `.github/workflows/deploy-pages.yml` on every push to `main`.
