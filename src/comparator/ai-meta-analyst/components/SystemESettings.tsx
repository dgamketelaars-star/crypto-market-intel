import { useState } from 'react';
import {
  AVAILABLE_ANTHROPIC_MODELS,
  AVAILABLE_OPENAI_MODELS,
  systemEApiKeyStore,
  type SystemEModel,
  type SystemEProvider,
} from '../settings/apiKeyStore';

const PROVIDER_LABELS: Record<SystemEProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
};

const AVAILABLE_MODELS_BY_PROVIDER: Record<SystemEProvider, SystemEModel[]> = {
  anthropic: AVAILABLE_ANTHROPIC_MODELS,
  openai: AVAILABLE_OPENAI_MODELS,
};

const KEY_PLACEHOLDER: Record<SystemEProvider, string> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
};

export function SystemESettings({ onSaved }: { onSaved: () => void }) {
  const [provider, setProvider] = useState<SystemEProvider>(systemEApiKeyStore.getProvider());
  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState<SystemEModel>(systemEApiKeyStore.getModel(provider));
  const hasKey = systemEApiKeyStore.hasApiKey(provider);

  const switchProvider = (next: SystemEProvider) => {
    setProvider(next);
    setKeyInput('');
    setModel(systemEApiKeyStore.getModel(next));
    systemEApiKeyStore.setProvider(next);
    onSaved();
  };

  const save = () => {
    if (keyInput.trim().length === 0) return;
    systemEApiKeyStore.setApiKey(provider, keyInput.trim());
    systemEApiKeyStore.setModel(provider, model);
    setKeyInput('');
    onSaved();
  };

  const clear = () => {
    systemEApiKeyStore.clearApiKey(provider);
    onSaved();
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
      <div className="mb-1 text-sm font-semibold text-slate-200">API key (bring-your-own-key)</div>
      <p className="mb-2 text-slate-500">
        Deze app heeft geen backend — je eigen API key wordt uitsluitend lokaal in de localStorage van déze browser bewaard en rechtstreeks vanuit je browser naar de gekozen provider gestuurd.
        Nooit gecommit, nooit naar een server van dit project. Iedereen met devtools-toegang tot dit apparaat kan de key zien. Elke analyse is een echte, betaalde API-aanroep op jouw eigen key.
      </p>

      <div className="mb-2 flex items-center gap-2">
        <span className="text-slate-300">Provider:</span>
        {(Object.keys(PROVIDER_LABELS) as SystemEProvider[]).map((p) => (
          <button
            key={p}
            onClick={() => switchProvider(p)}
            className={`rounded px-2 py-1 ${provider === p ? 'bg-sky-600 text-white' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>

      {hasKey ? (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-emerald-400">{PROVIDER_LABELS[provider]} key ingesteld.</span>
          <button onClick={clear} className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800">
            Verwijderen
          </button>
        </div>
      ) : (
        <div className="mb-2 text-amber-500">Geen {PROVIDER_LABELS[provider]} key ingesteld — System E blijft inactief zolang deze provider actief is.</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder={KEY_PLACEHOLDER[provider]}
          className="min-w-64 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
        />
        <select value={model} onChange={(e) => setModel(e.target.value as SystemEModel)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200">
          {AVAILABLE_MODELS_BY_PROVIDER[provider].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button onClick={save} className="rounded bg-sky-600 px-3 py-1 font-medium text-white hover:bg-sky-500">
          Opslaan
        </button>
      </div>
    </div>
  );
}
