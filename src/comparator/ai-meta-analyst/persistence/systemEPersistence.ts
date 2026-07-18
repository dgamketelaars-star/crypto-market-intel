import type { SystemERecord } from '../records/systemERecord';
import type { SystemELogEntry } from '../logging/systemELog';

const RECORDS_STORAGE_KEY = 'crypto-market-intel:system-e-records:v1';
const LOG_STORAGE_KEY = 'crypto-market-intel:system-e-log:v1';
/** Own choice: keep the log from growing unbounded in localStorage. */
const MAX_LOG_ENTRIES = 200;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(v: unknown): v is SystemERecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.symbol === 'string' && typeof r.generatedAt === 'number';
}

function isLogEntry(v: unknown): v is SystemELogEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.timestamp === 'number' && typeof e.success === 'boolean';
}

export const systemERecordPersistence = {
  load(): SystemERecord[] {
    if (!isBrowser()) return [];
    try {
      const raw = window.localStorage.getItem(RECORDS_STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
    } catch (error) {
      if (import.meta.env.DEV) console.error('[system-e-persistence] failed to load records', error);
      return [];
    }
  },
  save(records: SystemERecord[]): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      if (import.meta.env.DEV) console.error('[system-e-persistence] failed to save records', error);
    }
  },
  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(RECORDS_STORAGE_KEY);
  },
};

export const systemELogPersistence = {
  load(): SystemELogEntry[] {
    if (!isBrowser()) return [];
    try {
      const raw = window.localStorage.getItem(LOG_STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isLogEntry) : [];
    } catch (error) {
      if (import.meta.env.DEV) console.error('[system-e-persistence] failed to load log', error);
      return [];
    }
  },
  append(entry: SystemELogEntry): SystemELogEntry[] {
    const current = this.load();
    const next = [...current, entry].slice(-MAX_LOG_ENTRIES);
    if (isBrowser()) {
      try {
        window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        if (import.meta.env.DEV) console.error('[system-e-persistence] failed to save log', error);
      }
    }
    return next;
  },
  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(LOG_STORAGE_KEY);
  },
};
