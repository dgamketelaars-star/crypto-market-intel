import { setups } from '../../data/mock/setups';
import { useShowIntelligenceDebugPanel, useShowMockSetups, useShowSimulationPanel } from '../../hooks/useDevToggles';
import { MarketContextCard } from '../market/MarketContextCard';
import { MarketScannerSection } from '../scanner/MarketScannerSection';
import { GeneratedSetupsSection } from '../setups-generated/GeneratedSetupsSection';
import { SetupCard } from '../setups/SetupCard';
import { Badge } from '../ui/Badge';
import { DevToolsPanel } from '../dev/DevToolsPanel';
import { IntelligenceDebugPanel } from '../dev/IntelligenceDebugPanel';
import { SimulationPanel } from '../dev/SimulationPanel';

export function Dashboard() {
  const [showMock] = useShowMockSetups();
  const [showSimulation] = useShowSimulationPanel();
  const [showIntelligenceDebug] = useShowIntelligenceDebugPanel();

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">Setups</h2>
        </div>
        <GeneratedSetupsSection />
      </section>

      <MarketContextCard />

      <MarketScannerSection />

      {showIntelligenceDebug && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">Intelligence evidence (Fase 2)</h2>
            <Badge tone="accent" className="text-[10px]">
              Dev only
            </Badge>
          </div>
          <IntelligenceDebugPanel />
        </section>
      )}

      {showSimulation && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">Simulation</h2>
            <Badge tone="amber" className="text-[10px]">
              Dev only
            </Badge>
          </div>
          <SimulationPanel />
        </section>
      )}

      {showMock && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">Prototype mock setups</h2>
            <Badge tone="neutral" className="text-[10px]">
              Mock · {setups.length}
            </Badge>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Vaste voorbeeldkaarten uit de eerste prototype-ronde — losstaand van de echte setup-engine hierboven.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {setups.map((setup) => (
              <SetupCard key={setup.id} setup={setup} />
            ))}
          </div>
        </section>
      )}

      <DevToolsPanel />
    </main>
  );
}
