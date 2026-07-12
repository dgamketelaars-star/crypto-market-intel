import { SETUP_RULE_VERSION } from '../engine/rules';
import type { GeneratedSetup } from '../engine/types';
import type { SetupPersistenceAdapter } from './persistenceAdapter';

const STORAGE_KEY = 'crypto-market-intel:generated-setups:v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Every setup is stamped with the rule-engine version that produced it
 * (`ruleVersion`). The shape of `GeneratedSetup` has changed across rounds
 * (new required fields like `entry`, `closedPrice`, `changeLog` were added),
 * so a record persisted under an older version can be missing fields the
 * current UI assumes exist — reading them would throw and, with nothing to
 * catch it, take the whole app down to a blank screen.
 *
 * The version check alone isn't reliable enough on its own: `changeLog` was
 * added to the shape in a change that didn't bump `SETUP_RULE_VERSION`
 * (the string tracks rule *thresholds*, not the record shape), so a record
 * could pass the version check and still be missing a field the UI
 * dereferences unconditionally. Checking the shape directly for exactly
 * those fields is what actually prevents the crash — the version check is
 * just a fast first filter on top of it.
 */
function isCompatible(setup: unknown): setup is GeneratedSetup {
  if (typeof setup !== 'object' || setup === null) return false;
  const s = setup as Record<string, unknown>;
  if (s.ruleVersion !== SETUP_RULE_VERSION) return false;

  const changeLog = s.changeLog;
  if (typeof changeLog !== 'object' || changeLog === null) return false;
  if (!('entryZone' in changeLog) || !('invalidation' in changeLog) || !('targets' in changeLog)) return false;

  // Added this round — a record from before it existed would otherwise sail
  // through the version check above (same failure mode as changeLog once did).
  if (s.tradeHorizon !== 'DAY_TRADE' && s.tradeHorizon !== 'SWING_TRADE') return false;

  return true;
}

export class LocalStorageSetupPersistence implements SetupPersistenceAdapter {
  load(): GeneratedSetup[] {
    if (!isBrowser()) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isCompatible);
    } catch (error) {
      if (import.meta.env.DEV) console.error('[setup-persistence] failed to load', error);
      return [];
    }
  }

  save(setups: GeneratedSetup[]): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
    } catch (error) {
      if (import.meta.env.DEV) console.error('[setup-persistence] failed to save', error);
    }
  }

  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export const localStorageSetupPersistence = new LocalStorageSetupPersistence();
