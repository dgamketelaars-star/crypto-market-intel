import { useState } from 'react';
import { Header } from './components/layout/Header';
import { MarketDataStatusBar } from './components/data-status/MarketDataStatusBar';
import { Dashboard } from './components/dashboard/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SystemBPanel } from './comparator/open-source-strategy/components/SystemBPanel';
import { SystemCPanel } from './comparator/independent-analysis/components/SystemCPanel';
import { ComparisonPanel } from './comparator/ComparisonPanel';

type Tab = 'analyst' | 'system-b' | 'system-c' | 'compare';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'analyst', label: 'Onze analist' },
  { id: 'system-b', label: 'Open-source model' },
  { id: 'system-c', label: 'Onafhankelijke analyse' },
  { id: 'compare', label: 'Vergelijken' },
];

function App() {
  const [tab, setTab] = useState<Tab>('analyst');

  return (
    <div className="min-h-svh bg-slate-950 text-slate-200">
      <Header />
      <MarketDataStatusBar />
      <nav className="border-b border-slate-800 bg-slate-950/60">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <ErrorBoundary>
        {tab === 'analyst' && <Dashboard />}
        {tab === 'system-b' && (
          <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            <SystemBPanel />
          </main>
        )}
        {tab === 'system-c' && (
          <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            <SystemCPanel />
          </main>
        )}
        {tab === 'compare' && (
          <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            <ComparisonPanel />
          </main>
        )}
      </ErrorBoundary>
    </div>
  );
}

export default App;
