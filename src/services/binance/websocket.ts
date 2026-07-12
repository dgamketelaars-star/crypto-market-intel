import { combinedStreamUrl } from './endpoints';

export type WsStatus = 'open' | 'closed' | 'error';

type MessageHandler = (streamName: string, data: unknown) => void;
type StatusHandler = (status: WsStatus) => void;

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
/** Fallback stream so the connection URL is never empty before a universe is known. */
const KEEPALIVE_STREAM = 'btcusdt@markPrice@1s';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Manages a single combined-stream WebSocket connection to Binance Futures,
 * with exponential backoff reconnects and dynamic SUBSCRIBE/UNSUBSCRIBE of
 * streams without tearing down the socket.
 */
export class BinanceMarketStream {
  private ws: WebSocket | null = null;
  private streams = new Set<string>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = true;
  private nextRequestId = 1;
  private readonly onMessage: MessageHandler;
  private readonly onStatus: StatusHandler;

  constructor(onMessage: MessageHandler, onStatus: StatusHandler) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }

  /** Opens the connection with an initial set of streams. Safe to call once per session. */
  connect(initialStreams: string[]): void {
    this.manuallyClosed = false;
    this.streams = new Set(initialStreams);
    this.open();
  }

  /** Forces an immediate reconnect attempt, bypassing the current backoff timer. */
  forceReconnect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
    this.open();
  }

  /** Diffs against the currently subscribed streams and (un)subscribes only the delta. */
  setStreams(nextStreams: string[]): void {
    const next = new Set(nextStreams);
    const toAdd = [...next].filter((s) => !this.streams.has(s));
    const toRemove = [...this.streams].filter((s) => !next.has(s));
    this.streams = next;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (toAdd.length) this.send('SUBSCRIBE', toAdd);
    if (toRemove.length) this.send('UNSUBSCRIBE', toRemove);
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private open(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const streamList = this.streams.size ? [...this.streams] : [KEEPALIVE_STREAM];
    const ws = new WebSocket(combinedStreamUrl(streamList));
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.onStatus('open');
    };

    ws.onmessage = (event) => {
      try {
        const message: unknown = JSON.parse(event.data as string);
        if (isRecord(message) && typeof message.stream === 'string') {
          this.onMessage(message.stream, message.data);
        }
        // Messages without `stream` are SUBSCRIBE/UNSUBSCRIBE acks — nothing to do.
      } catch (error) {
        if (import.meta.env.DEV) console.error('[binance-ws] failed to parse message', error);
      }
    };

    ws.onerror = () => {
      this.onStatus('error');
    };

    ws.onclose = () => {
      this.onStatus('closed');
      this.ws = null;
      if (!this.manuallyClosed) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const attempt = this.reconnectAttempt++;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS) + Math.random() * 500;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manuallyClosed) this.open();
    }, delay);
  }

  private send(method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]): void {
    this.ws?.send(JSON.stringify({ method, params, id: this.nextRequestId++ }));
  }
}
