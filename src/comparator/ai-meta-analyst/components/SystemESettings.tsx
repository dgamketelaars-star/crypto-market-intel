import { useState } from 'react';
import { AVAILABLE_SYSTEM_E_MODELS, systemEApiKeyStore, type SystemEModel } from '../settings/apiKeyStore';

export function SystemESettings({ onSaved }: { onSaved: () => void }) {
  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState<SystemEModel>(systemEApiKeyStore.getModel());
  const hasKey = systemEApiKeyStore.hasApiKey();

  const save = () => {
    if (keyInput.trim().length === 0) return;
    systemEApiKeyStore.setApiKey(keyInput.trim());
    systemEApiKeyStore.setModel(model);
    setKeyInput('');
    onSaved();
  };

  const clear = () => {
    systemEApiKeyStore.clearApiKey();
    onSaved();
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
      <div className="mb-1 text-sm font-semibold text-slate-200">Anthropic API key (bring-your-own-key)</div>
      <p className="mb-2 text-slate-500">
        Deze app heeft geen backend — je eigen API key wordt uitsluitend lokaal in de localStorage van déze browser bewaard en rechtstreeks vanuit je browser naar de Anthropic API gestuurd. Nooit
        gecommit, nooit naar een server van dit project. Iedereen met devtools-toegang tot dit apparaat kan de key zien. Elke analyse is een echte, betaalde API-aanroep op jouw eigen key.
      </p>
      {hasKey ? (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-emerald-400">API key ingesteld.</span>
          <button onClick={clear} className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800">
            Verwijderen
          </button>
        </div>
      ) : (
        <div className="mb-2 text-amber-500">Geen API key ingesteld — System E blijft inactief.</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="sk-ant-..."
          className="min-w-64 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
        />
        <select value={model} onChange={(e) => setModel(e.target.value as SystemEModel)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200">
          {AVAILABLE_SYSTEM_E_MODELS.map((m) => (
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
