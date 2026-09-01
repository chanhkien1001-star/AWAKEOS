import test from 'node:test';
import assert from 'node:assert/strict';

import { createEventCollector, RawNativeEvents, type RawNativeEvent } from '@awake-os/core';
import { createNativeEventSource } from '../src/ingestion/native-event-source.ts';
import type { AwakeEventCollectorNative, RawEventEmitter, NativeSubscription } from '../src/ingestion/native-module.ts';

const NOW = Date.UTC(2026, 5, 1, 9, 0, 0);
const HASH = 'sha256:App0011_2233-4455667788990011223344556677889900aa';

function fakeClock(t: number) {
  return { now: () => t };
}
function fakeIds(seed = 'x') {
  let n = 0;
  return { uuid: () => `${seed}-${++n}` };
}

/** A fake native module: a `push()` helper drives the emitter; `queue()` fills the pull backstop. */
function fakeNative() {
  let listener: ((b: readonly RawNativeEvent[]) => void) | null = null;
  const nativeBuffer: RawNativeEvent[] = [];
  let started = false;

  const native: AwakeEventCollectorNative = {
    async start() {
      started = true;
      return { permission: 'granted' };
    },
    async stop() {
      started = false;
    },
    async drainPendingEvents() {
      const out = nativeBuffer.splice(0, nativeBuffer.length);
      return out;
    },
    async getStatus() {
      return { running: started, permission: 'granted', pendingNative: nativeBuffer.length, adapterVersion: 'fake-1' };
    },
    async openPermissionSettings() {},
  };

  const emitter: RawEventEmitter = {
    addListener(_evt, handler): NativeSubscription {
      listener = handler;
      return { remove: () => { listener = null; } };
    },
  };

  return {
    native,
    emitter,
    push: (batch: RawNativeEvent[]) => listener?.(batch),
    queue: (batch: RawNativeEvent[]) => nativeBuffer.push(...batch),
    isStarted: () => started,
  };
}

test('push channel: emitted batches flow through the collector to pull()', async () => {
  const f = fakeNative();
  const collector = createEventCollector({ ids: fakeIds(), clock: fakeClock(NOW + 10_000) });
  const src = createNativeEventSource({ native: f.native, emitter: f.emitter, collector });

  await src.start();
  assert.equal(f.isStarted(), true);

  f.push([RawNativeEvents.screen('Unlocked', NOW), RawNativeEvents.application('Foreground', HASH, NOW + 100)]);
  const events = await src.pull();
  assert.deepEqual(events.map((e) => e.type), ['ScreenStateChanged', 'ApplicationStateChanged']);
  src.dispose();
});

test('pull backstop: signals the OS buffered while JS slept are drained on pull()', async () => {
  const f = fakeNative();
  const collector = createEventCollector({ ids: fakeIds(), clock: fakeClock(NOW + 10_000) });
  const src = createNativeEventSource({ native: f.native, emitter: f.emitter, collector });

  f.queue([RawNativeEvents.screen('On', NOW), RawNativeEvents.explicitInput('scroll', NOW + 50)]);
  const events = await src.pull();
  assert.equal(events.length, 2);
  assert.equal((await src.pull()).length, 0);
});

test('push + backstop are de-duplicated by the shared collector', async () => {
  const f = fakeNative();
  const collector = createEventCollector({ ids: fakeIds(), clock: fakeClock(NOW + 10_000) });
  const src = createNativeEventSource({ native: f.native, emitter: f.emitter, collector });
  await src.start();

  const unlock = RawNativeEvents.screen('Unlocked', NOW);
  f.push([unlock]);
  f.queue([{ ...unlock, occurredAt: NOW + 80 }]); // same signal, still inside dedup window

  const events = await src.pull();
  assert.equal(events.length, 1);
  src.dispose();
});

test('a drain error does not break pull()', async () => {
  const f = fakeNative();
  f.native.drainPendingEvents = async () => {
    throw new Error('bridge closed');
  };
  const stages: string[] = [];
  const collector = createEventCollector({ ids: fakeIds(), clock: fakeClock(NOW + 10_000) });
  const src = createNativeEventSource({
    native: f.native,
    emitter: f.emitter,
    collector,
    telemetry: { stage: (n) => stages.push(n) },
  });

  await src.start();
  f.push([RawNativeEvents.screen('Off', NOW)]);
  const events = await src.pull();
  assert.equal(events.length, 1);
  assert.ok(stages.includes('ingestion.native.drain.error'));
});
