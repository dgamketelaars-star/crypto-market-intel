import { Component, type ReactNode } from 'react';
import { localStorageSetupPersistence } from '../setups/persistence/localStoragePersistence';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this, any render-time error (e.g. reading a field on a stale
 * persisted setup after a schema change) unmounts the entire React tree with
 * no feedback — the page just goes blank. This keeps the header visible and
 * gives the user an actual way to recover instead of a dead tab.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[error-boundary]', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    localStorageSetupPersistence.clear();
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="mb-2 text-sm font-semibold text-rose-400">Er ging iets mis</p>
          <p className="mb-6 text-sm text-slate-400">
            Er trad een onverwachte fout op tijdens het weergeven van deze pagina. Dit gebeurt soms na een update, als
            eerder opgeslagen setup-data niet meer bij de huidige versie past.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Opnieuw laden
            </button>
            <button
              type="button"
              onClick={this.handleClearAndReload}
              className="rounded-md bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-400 ring-1 ring-inset ring-sky-500/30 hover:bg-sky-500/25"
            >
              Opgeslagen setups wissen en opnieuw laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
