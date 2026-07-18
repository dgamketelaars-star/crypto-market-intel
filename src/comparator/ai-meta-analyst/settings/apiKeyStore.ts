/**
 * Bring-your-own-key storage for System E. Keys live ONLY in this browser's
 * localStorage — never sent anywhere except directly from this browser to
 * the chosen provider's API (dangerouslyAllowBrowser), and never committed
 * to the repository or logged. Visible to anyone with devtools access to
 * this device — acceptable for this project's personal, single-user use,
 * not for a shared/public deployment. See metadata/provenance.ts.
 *
 * Two providers are supported as alternatives, not simultaneously active —
 * the user picks one via setProvider(), and only that provider's key/model
 * are used by systemEStore. Both keys can be stored at once (e.g. while
 * switching providers to compare) without being cleared on switch.
 */
export type SystemEProvider = 'anthropic' | 'openai';

export type AnthropicModel = 'claude-opus-4-8' | 'claude-sonnet-5' | 'claude-haiku-4-5';
export type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini';
export type SystemEModel = AnthropicModel | OpenAIModel;

export const DEFAULT_PROVIDER: SystemEProvider = 'anthropic';
export const AVAILABLE_ANTHROPIC_MODELS: AnthropicModel[] = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'];
export const AVAILABLE_OPENAI_MODELS: OpenAIModel[] = ['gpt-4o', 'gpt-4o-mini'];

const DEFAULT_MODEL_BY_PROVIDER: Record<SystemEProvider, SystemEModel> = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4o',
};

const AVAILABLE_MODELS_BY_PROVIDER: Record<SystemEProvider, SystemEModel[]> = {
  anthropic: AVAILABLE_ANTHROPIC_MODELS,
  openai: AVAILABLE_OPENAI_MODELS,
};

// Anthropic storage keys are unchanged from before OpenAI support existed,
// so existing saved keys/models in users' browsers keep working.
const PROVIDER_STORAGE_KEY = 'crypto-market-intel:system-e-provider:v1';
const API_KEY_STORAGE_KEY_BY_PROVIDER: Record<SystemEProvider, string> = {
  anthropic: 'crypto-market-intel:system-e-anthropic-api-key:v1',
  openai: 'crypto-market-intel:system-e-openai-api-key:v1',
};
const MODEL_STORAGE_KEY_BY_PROVIDER: Record<SystemEProvider, string> = {
  anthropic: 'crypto-market-intel:system-e-model:v1',
  openai: 'crypto-market-intel:system-e-openai-model:v1',
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isValidProvider(value: string | null): value is SystemEProvider {
  return value === 'anthropic' || value === 'openai';
}

function getProvider(): SystemEProvider {
  if (!isBrowser()) return DEFAULT_PROVIDER;
  const stored = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
  return isValidProvider(stored) ? stored : DEFAULT_PROVIDER;
}

function setProvider(provider: SystemEProvider): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
}

function getApiKey(provider?: SystemEProvider): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(API_KEY_STORAGE_KEY_BY_PROVIDER[provider ?? getProvider()]);
}

function setApiKey(provider: SystemEProvider, key: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(API_KEY_STORAGE_KEY_BY_PROVIDER[provider], key.trim());
}

function clearApiKey(provider: SystemEProvider): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(API_KEY_STORAGE_KEY_BY_PROVIDER[provider]);
}

function hasApiKey(provider?: SystemEProvider): boolean {
  const key = getApiKey(provider);
  return key != null && key.length > 0;
}

function getModel(provider?: SystemEProvider): SystemEModel {
  const resolvedProvider = provider ?? getProvider();
  if (!isBrowser()) return DEFAULT_MODEL_BY_PROVIDER[resolvedProvider];
  const stored = window.localStorage.getItem(MODEL_STORAGE_KEY_BY_PROVIDER[resolvedProvider]);
  const available: string[] = AVAILABLE_MODELS_BY_PROVIDER[resolvedProvider];
  return available.includes(stored ?? '') ? (stored as SystemEModel) : DEFAULT_MODEL_BY_PROVIDER[resolvedProvider];
}

function setModel(provider: SystemEProvider, model: SystemEModel): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(MODEL_STORAGE_KEY_BY_PROVIDER[provider], model);
}

export const systemEApiKeyStore = {
  getProvider,
  setProvider,
  getApiKey,
  setApiKey,
  clearApiKey,
  hasApiKey,
  getModel,
  setModel,
};
