import type { SetupEvidence } from './types';

export function evidence(group: SetupEvidence['group'], label: string, detail: string): SetupEvidence {
  return { group, label, detail };
}

/** De-duplicates by evidence group, keeping the first entry per group — avoids double-counting closely related indicators. */
export function uniqueByGroup(items: SetupEvidence[]): SetupEvidence[] {
  const seen = new Set<string>();
  const result: SetupEvidence[] = [];
  for (const item of items) {
    if (seen.has(item.group)) continue;
    seen.add(item.group);
    result.push(item);
  }
  return result;
}
