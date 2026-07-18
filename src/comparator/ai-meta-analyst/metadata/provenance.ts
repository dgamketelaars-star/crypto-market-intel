/**
 * Code Provenance record for System E — the AI Meta Analyst.
 *
 * Unlike Systems B, C and D, System E is not a reimplementation of an
 * open-source repository's indicator/strategy code. It is a genuine, live
 * Claude API call (Anthropic Messages API, structured outputs) reasoning
 * over System A-D's published outputs plus raw Binance market data. There is
 * no upstream source to attribute — the "provenance" here is about the
 * infrastructure and safety trade-offs, not ported code.
 */
export const SYSTEM_E_ID = 'SYSTEM_E' as const;
export const SYSTEM_E_MODEL_NAME = 'AI Meta Analyst' as const;

export const SYSTEM_E_PROVENANCE = {
  systemId: SYSTEM_E_ID,
  displayName: SYSTEM_E_MODEL_NAME,
  nature: 'Live large-language-model reasoning (Anthropic Claude, Messages API), not a hardcoded rules engine and not a reimplementation of any open-source repository.',
  apiKeyHandling:
    'Bring-your-own-key: the Anthropic API key is entered by the user and stored ONLY in this browser\'s localStorage. It is sent directly from the browser to the Anthropic API (dangerouslyAllowBrowser) and never to any server this project controls. This app is a static GitHub Pages site with no backend, so there is nowhere else the key could safely live for a personal, single-user tool — this is a documented trade-off, not an oversight. The key is visible to anyone with devtools access to this specific browser/device.',
  costDisclosure:
    'Every analysis is a real, billed API call using the user\'s own key. System E runs automatically only on a long interval (not on the 5-second cadence used by Systems A-D) and only on a capped number of symbols per cycle, to keep cost predictable. Every call — success or failure — is logged with an estimated cost (see logging/systemELog.ts); the estimate is for transparency only, not a billing source of truth.',
  independenceFromOtherSystems:
    'System E reads the FINAL PUBLISHED OUTPUT of Systems A, B, C and D (direction, status, confidence/strength, entry, stop, targets, reasoning) — never their internal evidence, indicator, or signal-detection logic. This is by design: System E\'s entire purpose is to read and reason about other systems\' conclusions, which is architecturally different from A/B/C/D\'s mutual isolation from each other.',
  designRules: [
    'Never vote-counts or simply averages the four systems\' directions into a decision.',
    'Always produces all five blocks (consensus, independent analysis, comparison, final decision, motivation) — never a bare confidence number without reasoning attached.',
    'Explicitly checks for and names shared blind spots across A-D when present — and explicitly says "geen gedeelde denkfout gevonden" rather than inventing one when there is none.',
    'Distinguishes direction ("will price probably move") from trade location ("is now a good place to enter") as two separate assessments.',
    'Permitted to fully disagree with all four systems, or to see an opportunity all four miss, provided the reasoning is complete.',
  ],
  scopeDisclaimer:
    'Research and decision-support only. No automatic order execution, no API trading keys requested, no leverage recommendations, no profitability guarantees. A model output is one more independent opinion to weigh, not proof of correctness — agreement between systems is never presented as validation.',
} as const;
