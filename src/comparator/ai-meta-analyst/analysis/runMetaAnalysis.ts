import Anthropic from '@anthropic-ai/sdk';
import { createSystemEClient } from '../client/anthropicClient';
import type { SystemEModel } from '../settings/apiKeyStore';
import { buildSystemEUserContent, SYSTEM_E_SYSTEM_PROMPT, type RawMarketSnapshot, type SystemOutputSummary } from '../prompt/buildPrompt';
import { SYSTEM_E_OUTPUT_SCHEMA, type SystemEAnalysisResult } from '../prompt/outputSchema';

export interface RunMetaAnalysisInput {
  apiKey: string;
  model: SystemEModel;
  symbol: string;
  systemSummaries: SystemOutputSummary[];
  market: RawMarketSnapshot;
}

export interface RunMetaAnalysisUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface RunMetaAnalysisSuccess {
  ok: true;
  result: SystemEAnalysisResult;
  usage: RunMetaAnalysisUsage;
  model: string;
}

export interface RunMetaAnalysisFailure {
  ok: false;
  errorMessage: string;
  errorType: string;
}

export type RunMetaAnalysisResult = RunMetaAnalysisSuccess | RunMetaAnalysisFailure;

function classifyError(error: unknown): RunMetaAnalysisFailure {
  if (error instanceof Anthropic.AuthenticationError) return { ok: false, errorType: 'authentication_error', errorMessage: 'Ongeldige API key.' };
  if (error instanceof Anthropic.PermissionDeniedError) return { ok: false, errorType: 'permission_error', errorMessage: 'API key heeft geen toegang tot dit model.' };
  if (error instanceof Anthropic.RateLimitError) return { ok: false, errorType: 'rate_limit_error', errorMessage: 'Rate limit bereikt — probeer later opnieuw.' };
  if (error instanceof Anthropic.APIConnectionError) return { ok: false, errorType: 'connection_error', errorMessage: 'Netwerkfout bij verbinden met Anthropic API.' };
  if (error instanceof Anthropic.APIError) return { ok: false, errorType: error.type ?? 'api_error', errorMessage: error.message };
  return { ok: false, errorType: 'unknown_error', errorMessage: error instanceof Error ? error.message : String(error) };
}

export async function runMetaAnalysis(input: RunMetaAnalysisInput): Promise<RunMetaAnalysisResult> {
  const { apiKey, model, symbol, systemSummaries, market } = input;
  const client = createSystemEClient(apiKey);
  const userContent = buildSystemEUserContent(symbol, systemSummaries, market);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: SYSTEM_E_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userContent }],
      output_config: { format: { type: 'json_schema', schema: SYSTEM_E_OUTPUT_SCHEMA } },
    });

    if (response.stop_reason === 'refusal') {
      return { ok: false, errorType: 'refusal', errorMessage: 'Model weigerde deze aanvraag (safety classifier).' };
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!textBlock) return { ok: false, errorType: 'no_text_output', errorMessage: 'Geen tekstoutput ontvangen.' };

    const parsed = JSON.parse(textBlock.text) as SystemEAnalysisResult;

    return {
      ok: true,
      result: parsed,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
      model: response.model,
    };
  } catch (error) {
    return classifyError(error);
  }
}
