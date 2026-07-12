const DEFAULT_TIMEOUT_MS = 10_000;

export class BinanceApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'BinanceApiError';
    this.status = status;
  }
}

function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.error('[binance]', ...args);
  }
}

/** Fetches JSON from a public Binance endpoint with a timeout and normalized errors. */
export async function fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new BinanceApiError(`Binance request failed (${response.status})`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof BinanceApiError) {
      devLog(url, error);
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      const timeoutError = new BinanceApiError(`Binance request timed out after ${timeoutMs}ms`);
      devLog(url, timeoutError);
      throw timeoutError;
    }
    const wrapped = new BinanceApiError('Binance request failed');
    devLog(url, error);
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}
