import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEvent } from '../src/ingestion/event-normalizer.ts';
import { RawNativeEvents, type RawNativeEvent } from '../src/ingestion/raw-event.ts';
import { fixedClock } from '../src/util/clock.ts';
import { sequentialIdFactory } from '../src/util/id.ts';

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);
const deps = () => ({ ids: sequentialIdFactory('n'), clock: fixedClock(NOW) });
const HASH = 'sha256:Abc123_def456-GHIjklMNOpqrstuVWXyz01234567890AA';

test('accepts a clean ScreenStateChanged and fills schemaVersion + id', () => {
  const res = normalizeEvent(RawNativeEvents.screen('Unlocked', NOW - 1000), deps());
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.event.type, 'ScreenStateChanged');
    assert.deepEqual(res.event.payload, { state: 'Unlocked' });
    assert.equal(res.event.schemaVersion, '1.0.0');
    assert.equal(res.event.source.type, 'System');
    assert.equal(res.idRegenerated, true);
    assert.equal(res.event.id, 'n-1');
    assert.ok(Object.isFrozen(res.event));
  }
});

test('accepts ApplicationStateChanged with a salted hash', () => {
  const res = normalizeEvent(RawNativeEvents.application('Foreground', HASH, NOW - 5), deps());
  assert.ok(res.ok);
  if (res.ok) assert.equal((res.event.payload as { packageNameHash: string }).packageNameHash, HASH);
});

test('I-09: rejects a raw package id as UnhashedIdentifier', () => {
  for (const bad of ['com.instagram.android', 'com.zhiliaoapp.musically', 'sha256:short', 'AbcDef123456789012345']) {
    const raw: RawNativeEvent = {
      occurredAt: NOW - 5,
      type: 'ApplicationStateChanged',
      payload: { state: 'Foreground', packageNameHash: bad },
    };
    const res = normalizeEvent(raw, deps());
    assert.equal(res.ok, false, `should reject ${bad}`);
    if (!res.ok) assert.equal(res.reason, 'UnhashedIdentifier');
  }
});

test('I-02: rejects a payload carrying an extra field (window title / url / text)', () => {
  const raw: RawNativeEvent = {
    occurredAt: NOW - 5,
    type: 'ScreenStateChanged',
    payload: { state: 'On', windowTitle: 'DM with Alex — Instagram' },
  };
  const res = normalizeEvent(raw, deps());
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'DisallowedPayloadField');
});

test('I-02: rejects a free-text explicit-input actionId and a multiline value', () => {
  const badAction: RawNativeEvent = { occurredAt: NOW, type: 'ExplicitInputReceived', payload: { actionId: 'user typed: hello world' } };
  assert.equal(normalizeEvent(badAction, deps()).ok, false);

  const badValue: RawNativeEvent = { occurredAt: NOW, type: 'ExplicitInputReceived', payload: { actionId: 'note', value: 'line one\nline two' } };
  const res = normalizeEvent(badValue, deps());
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'DisallowedPayloadField');

  assert.ok(normalizeEvent(RawNativeEvents.explicitInput('video.play', NOW), deps()).ok);
});

test('rejects unknown type, bad timestamps, and schema mismatch', () => {
  assert.equal(normalizeEvent({ occurredAt: NOW, type: 'MoodChanged', payload: {} } as RawNativeEvent, deps()).ok, false);
  assert.equal(normalizeEvent({ occurredAt: 0, type: 'ScreenStateChanged', payload: { state: 'On' } }, deps()).ok, false);
  assert.equal(
    normalizeEvent({ occurredAt: NOW + 10 * 60_000, type: 'ScreenStateChanged', payload: { state: 'On' } }, deps()).ok,
    false,
  );
  assert.equal(
    normalizeEvent({ occurredAt: NOW, type: 'ScreenStateChanged', payload: { state: 'On' }, schemaVersion: '2.0.0' }, deps()).ok,
    false,
  );
});

test('preserves a well-formed UUIDv4 id from the adapter', () => {
  const id = '3f1a2b3c-4d5e-4f60-8a1b-2c3d4e5f6071';
  const res = normalizeEvent({ ...RawNativeEvents.screen('Off', NOW - 1), id }, deps());
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.event.id, id);
    assert.equal(res.idRegenerated, false);
  }
});
