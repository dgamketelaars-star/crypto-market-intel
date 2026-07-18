import OpenAI from 'openai';

/**
 * dangerouslyAllowBrowser is required for the same reason as
 * anthropicClient.ts — this app is a static site with no backend, so the
 * user's own OpenAI key is sent directly from their browser to OpenAI.
 */
export function createSystemEOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}
