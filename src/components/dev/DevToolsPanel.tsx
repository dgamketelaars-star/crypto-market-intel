import { useShowIntelligenceDebugPanel, useShowMockSetups, useShowSetupDebugPanel, useShowSimulationPanel } from '../../hooks/useDevToggles';
import { Card } from '../ui/Card';
import { Disclosure } from '../ui/Disclosure';
import { Toggle } from '../ui/Toggle';

export function DevToolsPanel() {
  const [showMock, setShowMock] = useShowMockSetups();
  const [showSimulation, setShowSimulation] = useShowSimulationPanel();
  const [showSetupDebug, setShowSetupDebug] = useShowSetupDebugPanel();
  const [showIntelligenceDebug, setShowIntelligenceDebug] = useShowIntelligenceDebugPanel();

  return (
    <Card className="p-5">
      <Disclosure label="Developer tools">
        <div className="divide-y divide-slate-800">
          <Toggle
            checked={showMock}
            onChange={setShowMock}
            label="Show prototype mock setups"
            description="Toont de originele SOL/DOGE-voorbeeldkaarten uit de eerste prototype-ronde, los van de echte setup-engine. Staat standaard uit."
          />
          <Toggle
            checked={showSimulation}
            onChange={setShowSimulation}
            label="Show simulation panel"
            description="Test de setup-lifecycle met vaste scenario's in plaats van live marktdata."
          />
          <Toggle
            checked={showSetupDebug}
            onChange={setShowSetupDebug}
            label="Show internal setup-engine state"
            description="Toont verborgen candidates en de LONG/SHORT conflict-resolutie per symbool — normaal alleen intern gebruikt door de engine. Staat standaard uit."
          />
          <Toggle
            checked={showIntelligenceDebug}
            onChange={setShowIntelligenceDebug}
            label="Show intelligence evidence panel"
            description="Toont de regime/structuur/evidence-synthese per symbool uit de nieuwe intelligence-laag (Fase 2) — nog niet gekoppeld aan setup-publicatie. Staat standaard uit."
          />
        </div>
      </Disclosure>
    </Card>
  );
}
