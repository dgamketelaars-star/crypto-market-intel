import { describe, expect, it } from 'vitest';
import { redactApiKeys } from './redact';

describe('redactApiKeys', () => {
  it('redacts an Anthropic-style key embedded in a message', () => {
    const message = 'Request failed with key sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890 attached';
    const redacted = redactApiKeys(message);
    expect(redacted).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
    expect(redacted).toContain('[redacted]');
  });

  it('redacts an OpenAI-style key embedded in a message', () => {
    const message = 'Auth header: Bearer sk-proj-abcdefghijklmnopqrstuvwxyz1234567890';
    const redacted = redactApiKeys(message);
    expect(redacted).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
  });

  it('leaves ordinary error text untouched', () => {
    const message = 'Rate limit bereikt — probeer later opnieuw.';
    expect(redactApiKeys(message)).toBe(message);
  });
});
