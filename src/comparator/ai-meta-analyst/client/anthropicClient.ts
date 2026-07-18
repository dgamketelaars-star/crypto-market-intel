import Anthropic from '@anthropic-ai/sdk';

/**
 * dangerouslyAllowBrowser is required because this app is a static site with
 * no backend — the user's own API key (see settings/apiKeyStore.ts) is sent
 * directly from their browser to Anthropic. This is the accepted, documented
 * trade-off for a personal, single-user research tool; see provenance.ts.
 */
export function createSystemEClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}
