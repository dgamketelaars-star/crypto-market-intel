/**
 * Deel 9 safety requirement: error messages, debug output, and request
 * logging must never show a full API key. SDK error messages are not
 * expected to ever contain the key (it travels in a header, not the
 * response body an error is built from), but this is cheap, defense-in-
 * depth insurance against a future SDK version changing that, or a network
 * proxy echoing request details back into an error string.
 */
const API_KEY_PATTERN = /\b(sk-ant-[a-zA-Z0-9_-]{6,}|sk-[a-zA-Z0-9_-]{16,})\b/g;

export function redactApiKeys(text: string): string {
  return text.replace(API_KEY_PATTERN, (match) => `${match.slice(0, 7)}…[redacted]`);
}
