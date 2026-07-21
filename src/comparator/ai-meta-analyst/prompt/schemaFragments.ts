/** Shared JSON-schema building blocks for the phase 1 / phase 2 structured outputs. Kept strict-mode compatible for OpenAI (every property required, nullability via `type` arrays, `additionalProperties: false` everywhere) — Anthropic's structured outputs accept this same shape too. */

export const DECISION_ENUM = ['LONG', 'SHORT', 'WAIT', 'NO_TRADE'] as const;
export const CONFIDENCE_ENUM = ['low', 'medium', 'high'] as const;
export const SETUP_QUALITY_ENUM = ['A+', 'A', 'B', 'C', 'D'] as const;

export const ZONE_SCHEMA = {
  type: ['object', 'null'],
  properties: {
    low: { type: 'number' },
    high: { type: 'number' },
  },
  required: ['low', 'high'],
  additionalProperties: false,
} as const;

export const TARGET_LIST_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      price: { type: 'number' },
      reason: { type: 'string' },
    },
    required: ['price', 'reason'],
    additionalProperties: false,
  },
} as const;

export const STRING_LIST_SCHEMA = { type: 'array', items: { type: 'string' } } as const;
export const NUMBER_LIST_SCHEMA = { type: 'array', items: { type: 'number' } } as const;
