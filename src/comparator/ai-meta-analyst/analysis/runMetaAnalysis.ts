import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createSystemEClient } from '../client/anthropicClient';
import { createSystemEOpenAIClient } from '../client/openaiClient';
import type { SystemEModel, SystemEProvider } from '../settings/apiKeyStore';
import { buildPhase1UserContent, SYSTEM_E_PHASE1_SYSTEM_PROMPT } from '../prompt/phase1Prompt';
import { SYSTEM_E_PHASE1_SCHEMA, type SystemEPhase1Result } from '../prompt/phase1Schema';
import { buildPhase2UserContent, SYSTEM_E_PHASE2_SYSTEM_PROMPT } from '../prompt/phase2Prompt';
import { SYSTEM_E_PHASE2_SCHEMA, type SystemEPhase2Result } from '../prompt/phase2Schema';
import type { RawMarketSnapshot } from '../prompt/marketData';
import type { SystemOutputSummary } from '../prompt/systemSummary';
import { redactApiKeys } from '../logging/redact';

export interface RunMetaAnalysisUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface StructuredCallSuccess<T> {
  ok: true;
  result: T;
  usage: RunMetaAnalysisUsage;
  model: string;
}

export interface StructuredCallFailure {
  ok: false;
  errorMessage: string;
  errorType: string;
}

export type StructuredCallResult<T> = StructuredCallSuccess<T> | StructuredCallFailure;

function classifyAnthropicError(error: unknown): StructuredCallFailure {
  if (error instanceof Anthropic.AuthenticationError) return { ok: false, errorType: 'authentication_error', errorMessage: 'Ongeldige API key.' };
  if (error instanceof Anthropic.PermissionDeniedError) return { ok: false, errorType: 'permission_error', errorMessage: 'API key heeft geen toegang tot dit model.' };
  if (error instanceof Anthropic.RateLimitError) return { ok: false, errorType: 'rate_limit_error', errorMessage: 'Rate limit bereikt — probeer later opnieuw.' };
  if (error instanceof Anthropic.APIConnectionError) return { ok: false, errorType: 'connection_error', errorMessage: 'Netwerkfout bij verbinden met Anthropic API.' };
  if (error instanceof Anthropic.APIError) return { ok: false, errorType: error.type ?? 'api_error', errorMessage: redactApiKeys(error.message) };
  return { ok: false, errorType: 'unknown_error', errorMessage: redactApiKeys(error instanceof Error ? error.message : String(error)) };
}

function classifyOpenAIError(error: unknown): StructuredCallFailure {
  if (error instanceof OpenAI.AuthenticationError) return { ok: false, errorType: 'authentication_error', errorMessage: 'Ongeldige API key.' };
  if (error instanceof OpenAI.PermissionDeniedError) return { ok: false, errorType: 'permission_error', errorMessage: 'API key heeft geen toegang tot dit model.' };
  if (error instanceof OpenAI.RateLimitError) return { ok: false, errorType: 'rate_limit_error', errorMessage: 'Rate limit bereikt — probeer later opnieuw.' };
  if (error instanceof OpenAI.APIConnectionError) return { ok: false, errorType: 'connection_error', errorMessage: 'Netwerkfout bij verbinden met OpenAI API.' };
  if (error instanceof OpenAI.APIError) return { ok: false, errorType: error.type ?? 'api_error', errorMessage: redactApiKeys(error.message) };
  return { ok: false, errorType: 'unknown_error', errorMessage: redactApiKeys(error instanceof Error ? error.message : String(error)) };
}

async function callAnthropicStructured<T>(apiKey: string, model: SystemEModel, systemPrompt: string, userContent: string, schema: Record<string, unknown>): Promise<StructuredCallResult<T>> {
  const client = createSystemEClient(apiKey);
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userContent }],
      output_config: { format: { type: 'json_schema', schema } },
    });

    if (response.stop_reason === 'refusal') {
      return { ok: false, errorType: 'refusal', errorMessage: 'Model weigerde deze aanvraag (safety classifier).' };
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!textBlock) return { ok: false, errorType: 'no_text_output', errorMessage: 'Geen tekstoutput ontvangen.' };

    const parsed = JSON.parse(textBlock.text) as T;

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
    return classifyAnthropicError(error);
  }
}

async function callOpenAIStructured<T>(apiKey: string, model: SystemEModel, systemPrompt: string, userContent: string, schema: Record<string, unknown>, schemaName: string): Promise<StructuredCallResult<T>> {
  const client = createSystemEOpenAIClient(apiKey);
  try {
    const response = await client.chat.completions.create({
      model,
      max_completion_tokens: 8000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, strict: true, schema },
      },
    });

    const choice = response.choices[0];
    if (choice?.finish_reason === 'content_filter') {
      return { ok: false, errorType: 'refusal', errorMessage: 'Model weigerde deze aanvraag (content filter).' };
    }

    const text = choice?.message.content;
    if (!text) return { ok: false, errorType: 'no_text_output', errorMessage: 'Geen tekstoutput ontvangen.' };

    const parsed = JSON.parse(text) as T;

    return {
      ok: true,
      result: parsed,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        cacheReadInputTokens: response.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        cacheCreationInputTokens: 0,
      },
      model: response.model,
    };
  } catch (error) {
    return classifyOpenAIError(error);
  }
}

async function callStructured<T>(provider: SystemEProvider, apiKey: string, model: SystemEModel, systemPrompt: string, userContent: string, schema: Record<string, unknown>, schemaName: string): Promise<StructuredCallResult<T>> {
  return provider === 'openai'
    ? callOpenAIStructured<T>(apiKey, model, systemPrompt, userContent, schema, schemaName)
    : callAnthropicStructured<T>(apiKey, model, systemPrompt, userContent, schema);
}

export interface RunPhase1Input {
  provider: SystemEProvider;
  apiKey: string;
  model: SystemEModel;
  market: RawMarketSnapshot;
}

/** Phase 1 — independent analysis, no A-D visibility. See prompt/phase1Prompt.ts. */
export async function runPhase1Analysis(input: RunPhase1Input): Promise<StructuredCallResult<SystemEPhase1Result>> {
  const userContent = buildPhase1UserContent(input.market);
  return callStructured<SystemEPhase1Result>(input.provider, input.apiKey, input.model, SYSTEM_E_PHASE1_SYSTEM_PROMPT, userContent, SYSTEM_E_PHASE1_SCHEMA, 'system_e_phase1_analysis');
}

export interface RunPhase2Input {
  provider: SystemEProvider;
  apiKey: string;
  model: SystemEModel;
  symbol: string;
  phase1: SystemEPhase1Result;
  systemSummaries: SystemOutputSummary[];
}

/** Phase 2 — reads phase 1's locked-in result plus A-D's published output, and produces the final decision. See prompt/phase2Prompt.ts. */
export async function runPhase2Analysis(input: RunPhase2Input): Promise<StructuredCallResult<SystemEPhase2Result>> {
  const userContent = buildPhase2UserContent(input.symbol, input.phase1, input.systemSummaries);
  return callStructured<SystemEPhase2Result>(input.provider, input.apiKey, input.model, SYSTEM_E_PHASE2_SYSTEM_PROMPT, userContent, SYSTEM_E_PHASE2_SCHEMA, 'system_e_phase2_analysis');
}
