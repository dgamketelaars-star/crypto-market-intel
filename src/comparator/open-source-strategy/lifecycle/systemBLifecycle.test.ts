import { describe, expect, it } from 'vitest';
import { advanceSystemBSetup, createTriggeredSetup, expireVanishedSystemBSetup } from './systemBLifecycle';

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60_000;

describe('createTriggeredSetup', () => {
  it('creates a LONG setup in entry_triggered status with a stop 26.5% below the trigger price', () => {
    const setup = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW, 'live');
    expect(setup.status).toBe('entry_triggered');
    expect(setup.triggerPrice).toBe(100);
    expect(setup.stopPrice).toBeCloseTo(73.5);
    expect(setup.entryPrice).toBeNull();
  });

  it('creates a SHORT setup with a stop 26.5% above the trigger price', () => {
    const setup = createTriggeredSetup('SOLUSDT', 'SHORT', 100, NOW, 'live');
    expect(setup.stopPrice).toBeCloseTo(126.5);
  });
});

describe('advanceSystemBSetup', () => {
  it('transitions entry_triggered -> active on the next evaluation, fixing the entry price', () => {
    const triggered = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW, 'live');
    const active = advanceSystemBSetup(triggered, 101, NOW + HOUR, false);
    expect(active.status).toBe('active');
    expect(active.entryPrice).toBe(100);
    expect(active.peakFavorablePrice).toBe(100);
  });

  it('closes with reason "stop" once price reaches the fixed stoploss', () => {
    const triggered = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW, 'live');
    const active = advanceSystemBSetup(triggered, 100, NOW + HOUR, false);
    const closed = advanceSystemBSetup(active, 73, NOW + 2 * HOUR, false);
    expect(closed.status).toBe('closed');
    expect(closed.closedReason).toBe('stop');
  });

  it('closes with reason "roi" once profit reaches the applicable ROI-table threshold', () => {
    const triggered = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW, 'live');
    const active = advanceSystemBSetup(triggered, 100, NOW, false);
    // 10% required at t=0
    const closed = advanceSystemBSetup(active, 111, NOW + 5 * 60_000, false);
    expect(closed.status).toBe('closed');
    expect(closed.closedReason).toBe('roi');
  });

  it('closes with reason "trailing_stop" once price retraces 5% from the post-entry peak', () => {
    const triggered = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW, 'live');
    let setup = advanceSystemBSetup(triggered, 100, NOW, false);
    setup = advanceSystemBSetup(setup, 108, NOW + 10 * 60_000, false); // peak 108, in profit, below ROI(10%) threshold
    expect(setup.status).toBe('active');
    const closed = advanceSystemBSetup(setup, 102, NOW + 20 * 60_000, false); // 102 <= 108 * 0.95 = 102.6
    expect(closed.status).toBe('closed');
    expect(closed.closedReason).toBe('trailing_stop');
  });

  it('closes with reason "signal_exit" when the signal fires and no price-based exit has triggered', () => {
    const triggered = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW, 'live');
    const active = advanceSystemBSetup(triggered, 100, NOW, false);
    const closed = advanceSystemBSetup(active, 100.5, NOW + 5 * 60_000, true);
    expect(closed.status).toBe('closed');
    expect(closed.closedReason).toBe('signal_exit');
  });

  it('leaves a closed setup passed back through advance() untouched by an already-closed caller (defensive no-op path)', () => {
    const triggered = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW, 'live');
    let setup = advanceSystemBSetup(triggered, 100, NOW, false);
    setup = advanceSystemBSetup(setup, 73, NOW + HOUR, false);
    expect(setup.status).toBe('closed');
    const untouched = advanceSystemBSetup(setup, 200, NOW + 2 * HOUR, false);
    expect(untouched.status).toBe('closed');
    expect(untouched.closedPrice).toBe(73);
  });
});

describe('expireVanishedSystemBSetup', () => {
  it('force-invalidates an open setup once its symbol leaves the tracked universe', () => {
    const triggered = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW, 'live');
    const expired = expireVanishedSystemBSetup(triggered, NOW + HOUR, 103);
    expect(expired).not.toBeNull();
    expect(expired!.status).toBe('invalidated');
    expect(expired!.closedReason).toBe('vanished');
    expect(expired!.closedPrice).toBe(103);
  });

  it('does nothing to an already-closed setup', () => {
    const triggered = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW, 'live');
    let setup = advanceSystemBSetup(triggered, 100, NOW, false);
    setup = advanceSystemBSetup(setup, 73, NOW + HOUR, false);
    expect(expireVanishedSystemBSetup(setup, NOW + 2 * HOUR, 80)).toBeNull();
  });
});
