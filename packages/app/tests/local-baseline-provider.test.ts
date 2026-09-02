import test from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryStore, RawNativeEvents, createEventCollector } from '@awake-os/core';
import { createLocalBaselineProvider } from '../src/baseline/local-baseline-provider.ts';

const DAY = 24 * 60 * 60_000;
const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);

function mutableClock(t: number) {
  return { now: () => t, set: (v: number) => { t = v; } };
}

/** Populate a store with N midday sessions of ~`minutes` each. */
async function seed(store: Awaited<ReturnType<typeof createMemoryStore>>, days: number, minutes: number) {
  const ids = { uuid: (() => { let n = 0; return () => `s-${++n}`; })() };
  const collector = createEventCollector({ ids, clock: { now: () => NOW } });
  for (let d = 1; d <= days; d++) {
    const start = NOW - d * DAY;
    const raws = [
      RawNativeEvents.screen('Unlocked', start),
      RawNativeEvents.application('Foreground', 'sha256:aaaaaaaaaaaaaaaaaaaa', start + 1_000),
    ];
    for (let i = 1; i <= 15; i++) raws.push(RawNativeEvents.explicitInput('scroll', start + i * (minutes * 60_000 / 15)));
    raws.push(RawNativeEvents.screen('Locked', start + minutes * 60_000 + 5_000));
    collector.ingestRaw(raws);
  }
  for (const e of await collector.pull()) await store.appendEvent(e);
}

test('builds a baseline from the local store and caches it', async () => {
  const store = createMemoryStore();
  await seed(store, 10, 12);
  let reads = 0;
  const spyStore = { ...store, readEvents: (a: number, b: number) => { reads++; return store.readEvents(a, b); } };
  const clock = mutableClock(NOW);

  const provider = createLocalBaselineProvider({ store: spyStore, clock, recomputeEveryMs: 60_000 });

  const b1 = await provider.getBaseline();
  assert.equal(b1.byTimeFrame['12:00-18:00'].observations, 10);
  assert.ok(b1.byTimeFrame['12:00-18:00'].sessionDurationMs.median > 9 * 60_000);

  await provider.getBaseline(); // within TTL -> cache hit, no extra read
  assert.equal(reads, 1);

  clock.set(NOW + 2 * 60_000); // past TTL
  await provider.getBaseline();
  assert.equal(reads, 2);
});

test('invalidate() forces a recompute', async () => {
  const store = createMemoryStore();
  await seed(store, 3, 10);
  let reads = 0;
  const spyStore = { ...store, readEvents: (a: number, b: number) => { reads++; return store.readEvents(a, b); } };
  const provider = createLocalBaselineProvider({ store: spyStore, clock: { now: () => NOW }, recomputeEveryMs: 10 * 60_000 });

  await provider.getBaseline();
  await provider.getBaseline();
  assert.equal(reads, 1);
  provider.invalidate();
  await provider.getBaseline();
  assert.equal(reads, 2);
});

test('a store read failure degrades to an empty baseline, not a throw', async () => {
  const provider = createLocalBaselineProvider({
    store: {
      appendEvent: async () => {},
      appendChoice: async () => {},
      appendInterventionRecord: async () => {},
      saveReflection: async () => {},
      readEvents: async () => { throw new Error('disk gone'); },
      readChoices: async () => [],
      readInterventionRecords: async () => [],
    },
    clock: { now: () => NOW },
  });
  const b = await provider.getBaseline();
  assert.equal(b.totalSessions, 0);
});
