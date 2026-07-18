/**
 * Bring-your-own-key storage for System E. The key lives ONLY in this
 * browser's localStorage — it is never sent anywhere except directly from
 * this browser to Anthropic's API (dangerouslyAllowBrowser), and is never
 * committed to the repository or logged. Visible to anyone with devtools
 * access to this device — acceptable for this project's personal, single-user
 * use, not for a shared/public deployment. See metadata/provenance.ts.
 */
const API_KEY_STORAGE_KEY = 'crypto-market-intel:system-e-anthropic-api-key:v1';
const MODEL_STORAGE_KEY = 'crypto-market-intel:system-e-model:v1';

export type SystemEModel = 'claude-opus-4-8' | 'claude-sonnet-5' | 'claude-haiku-4-5';
export const DEFAULT_SYSTEM_E_MODEL: SystemEModel = 'claude-opus-4-8';
export const AVAILABLE_SYSTEM_E_MODELS: SystemEModel[] = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'];

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const systemEApiKeyStore = {
  getApiKey(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(API_KEY_STORAGE_KEY);
  },
  setApiKey(key: string): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
  },
  clearApiKey(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  },
  hasApiKey(): boolean {
    const key = this.getApiKey();
    return key != null && key.length > 0;
  },
  getModel(): SystemEModel {
    if (!isBrowser()) return DEFAULT_SYSTEM_E_MODEL;
    const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
    return (AVAILABLE_SYSTEM_E_MODELS as string[]).includes(stored ?? '') ? (stored as SystemEModel) : DEFAULT_SYSTEM_E_MODEL;
  },
  setModel(model: SystemEModel): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  },
};
