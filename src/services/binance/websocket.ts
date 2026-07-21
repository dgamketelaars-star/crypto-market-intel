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

/** Binance documents a hard limit of 200 streams per combined-stream connection. Kept well under that so a handful of extra streams (e.g. the all-market forceOrder stream) never tips a shard over. */
const MAX_STREAMS_PER_SHARD = 180;

export function symbolFromStreamName(streamName: string): string {
  const at = streamName.indexOf('@');
  return at === -1 ? streamName : streamName.slice(0, at);
}

/** Simple, deterministic string hash — good enough to spread symbols evenly across shards, not for anything security-sensitive. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/** Which shard (0-indexed) a given stream name belongs to, for a sharding scheme with `shardCount` connections. Exported standalone so the stability property (same symbol -> same shard, independent of what else is in the universe) can be unit tested without spinning up real WebSockets. */
export function shardIndexForStream(streamName: string, shardCount: number): number {
  return hashString(symbolFromStreamName(streamName)) % Math.max(1, shardCount);
}

/**
 * Fans a large stream list out across N underlying BinanceMarketStream
 * connections, because a single connection is capped at ~200 streams —
 * a 50-symbol universe alone needs 50 * 6 (ticker + markPrice + 4 kline
 * intervals) = 300, well past that limit. Same public API as
 * BinanceMarketStream so marketDataStore's usage barely changes.
 *
 * Sharding is by a hash of the symbol (not by list position), so a given
 * symbol always lands on the same connection regardless of which other
 * symbols are currently tracked — adding/removing one symbol from the
 * universe only touches its own shard's SUBSCRIBE/UNSUBSCRIBE, instead of
 * reshuffling everyone else's connection on every universe refresh.
 */
export class ShardedBinanceMarketStream {
  private readonly shards: BinanceMarketStream[];
  private readonly shardStatus: WsStatus[];
  private readonly onStatus: StatusHandler;
  private readonly shardCount: number;

  constructor(onMessage: MessageHandler, onStatus: StatusHandler, shardCount: number) {
    this.onStatus = onStatus;
    this.shardCount = Math.max(1, shardCount);
    this.shardStatus = Array.from({ length: this.shardCount }, () => 'closed' as WsStatus);
    this.shards = Array.from(
      { length: this.shardCount },
      (_, index) => new BinanceMarketStream(onMessage, (status) => this.handleShardStatus(index, status)),
    );
  }

  /** Derive a shard count that keeps every shard comfortably under Binance's per-connection stream limit. */
  static shardCountFor(estimatedStreamCount: number): number {
    return Math.max(1, Math.ceil(estimatedStreamCount / MAX_STREAMS_PER_SHARD));
  }

  private handleShardStatus(index: number, status: WsStatus): void {
    this.shardStatus[index] = status;
    const allOpen = this.shardStatus.every((s) => s === 'open');
    const anyError = this.shardStatus.some((s) => s === 'error');
    this.onStatus(allOpen ? 'open' : anyError ? 'error' : 'closed');
  }

  private groupByShard(streams: string[]): string[][] {
    const groups: string[][] = Array.from({ length: this.shardCount }, () => []);
    for (const stream of streams) groups[shardIndexForStream(stream, this.shardCount)].push(stream);
    return groups;
  }

  connect(initialStreams: string[]): void {
    const groups = this.groupByShard(initialStreams);
    this.shards.forEach((shard, i) => shard.connect(groups[i]));
  }

  forceReconnect(): void {
    this.shards.forEach((shard) => shard.forceReconnect());
  }

  setStreams(nextStreams: string[]): void {
    const groups = this.groupByShard(nextStreams);
    this.shards.forEach((shard, i) => shard.setStreams(groups[i]));
  }

  close(): void {
    this.shards.forEach((shard) => shard.close());
  }
}
