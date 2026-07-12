import { Header } from './components/layout/Header';
import { MarketDataStatusBar } from './components/data-status/MarketDataStatusBar';
import { Dashboard } from './components/dashboard/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <div className="min-h-svh bg-slate-950 text-slate-200">
      <Header />
      <MarketDataStatusBar />
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </div>
  );
}

export default App;
