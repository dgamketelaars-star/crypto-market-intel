/** One system's (A/B/C/D) published output for a symbol, as System E is allowed to see it — final conclusion only, never internal indicator values or decision logic. See systemEStore.ts's builders. */
export interface SystemOutputSummary {
  systemId: 'A' | 'B' | 'C' | 'D';
  systemName: string;
  hasSetup: boolean;
  direction?: 'LONG' | 'SHORT';
  status?: string;
  confidenceOrStrength?: string;
  entryDescription?: string;
  stopPrice?: number | null;
  targets?: number[];
  reasoning: string[];
  warnings: string[];
}

export function formatSystemSummary(s: SystemOutputSummary): string {
  if (!s.hasSetup) {
    return `Systeem ${s.systemId} (${s.systemName}): geen actieve setup voor dit symbool.`;
  }
  const lines = [
    `Systeem ${s.systemId} (${s.systemName}): ${s.direction} — status: ${s.status} — confidence/sterkte: ${s.confidenceOrStrength ?? 'onbekend'}`,
  ];
  if (s.entryDescription) lines.push(`  Entry: ${s.entryDescription}`);
  if (s.stopPrice != null) lines.push(`  Stop: ${s.stopPrice}`);
  if (s.targets && s.targets.length > 0) lines.push(`  Targets: ${s.targets.join(', ')}`);
  if (s.reasoning.length > 0) lines.push(`  Onderbouwing in gepubliceerde output: ${s.reasoning.join(' | ')}`);
  if (s.warnings.length > 0) lines.push(`  Waarschuwingen in gepubliceerde output: ${s.warnings.join(' | ')}`);
  return lines.join('\n');
}
