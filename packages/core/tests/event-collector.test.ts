import test from 'node:test';
import assert from 'node:assert/strict';

import { createEventCollector } from '../src/ingestion/event-collector.ts';
import { RawNativeEvents, type RawNativeEvent } from '../src/ingestion/raw-event.ts';
import { fixedClock } from '../src/util/clock.ts';
import { sequentialIdFactory } from '../src/util/id.ts';

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);
const HASH_A = 'sha256:AAaa11_bb22-cc33dd44ee55ff66gg77hh88ii99jj00kk';
const mk = (over: Partial<{ telemetry: { stage: (n: string, d: Record<string, unknown>) => void }; config: object }> = {}) =>
  createEventCollector({ ids: sequentialIdFactory('c'), clock: fixedClock(NOW), ...over });

test('ingests a batch and pulls it back oldest-first', async () => {
  const c = mk();
  const summary = c.ingestRaw([
    RawNativeEvents.explicitInput('scroll', NOW + 300),
    RawNativeEvents.screen('Unlocked', NOW + 100),
    RawNativeEvents.application('Foreground', HASH_A, NOW + 200),
  ]);
  assert.equal(summary.accepted, 3);
  assert.equal(c.pendingCount(), 3);

  const events = await c.pull();
  assert.deepEqual(events.map((e) => e.occurredAt), [NOW + 100, NOW + 200, NOW + 300]);
  assert.equal(c.pendingCount(), 0);
  assert.deepEqual(await c.pull(), []);
});

test('I-05: de-bounces identical signals inside the dedup window', async () => {
  const c = mk();
  const s = c.ingestRaw([
    RawNativeEvents.screen('Off', NOW),
    RawNativeEvents.screen('Off', NOW + 50), // sensor bounce
    RawNativeEvents.screen('Off', NOW + 120),
  ]);
  assert.equal(s.accepted, 1);
  assert.equal(s.deduped, 2);
  assert.equal((await c.pull()).length, 1);
});

test('the same signal outside the window is a real second event', async () => {
  const c = mk();
  c.ingestRaw(RawNativeEvents.screen('Unlocked', NOW));
  c.ingestRaw(RawNativeEvents.screen('Unlocked', NOW + 5_000));
  assert.equal((await c.pull()).length, 2);
});

test('invalid raw events are counted, never emitted', async () => {
  const c = mk();
  const s = c.ingestRaw([
    RawNativeEvents.screen('On', NOW),
    { occurredAt: NOW, type: 'ApplicationStateChanged', payload: { state: 'Foreground', packageNameHash: 'com.tiktok' } } as RawNativeEvent,
    { occurredAt: NOW, type: 'Nope', payload: {} } as RawNativeEvent,
  ]);
  assert.equal(s.accepted, 1);
  assert.equal(s.rejected, 2);
  assert.equal(s.rejections.UnhashedIdentifier, 1);
  assert.equal(s.rejections.UnknownEventType, 1);
  assert.equal((await c.pull()).length, 1);
});

test('recordExplicitInput produces one ExplicitInputReceived event at clock time', async () => {
  const c = mk();
  c.recordExplicitInput('reaction.like', 'post');
  const [e] = await c.pull();
  assert.equal(e?.type, 'ExplicitInputReceived');
  assert.equal(e?.occurredAt, NOW);
  assert.deepEqual(e?.payload, { actionId: 'reaction.like', value: 'post' });
});

test('buffer overflow drops the OLDEST events and reports it', async () => {
  const stages: { name: string; detail: Record<string, unknown> }[] = [];
  const c = mk({ telemetry: { stage: (name, detail) => stages.push({ name, detail }) }, config: { maxBufferSize: 10, dedupWindowMs: 0 } });
  const raws = Array.from({ length: 25 }, (_, i) => RawNativeEvents.explicitInput('scroll', NOW + i));
  c.ingestRaw(raws);
  const events = await c.pull();
  assert.equal(events.length, 10);
  assert.equal(events[0]!.occurredAt, NOW + 15); // oldest 15 dropped
  assert.ok(stages.some((s) => s.name === 'ingestion.overflow' && s.detail.dropped === 15));
});
