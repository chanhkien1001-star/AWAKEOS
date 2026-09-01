import test from 'node:test';
import assert from 'node:assert/strict';

import { buildContext } from '../src/engines/context-builder.ts';
import { sequentialIdFactory } from '../src/util/id.ts';
import { app, input, screen, resetEventIds } from './helpers.ts';

const ids = () => sequentialIdFactory('ctx');

test('derives the time frame, ISO day of week, and rest-period flag', () => {
  resetEventIds();
  const at = Date.UTC(2026, 0, 5, 23, 30, 0); // Monday 23:30 UTC
  const ev = screen('Unlocked', at);
  const c = buildContext(ev, [ev], ids(), { restPeriods: { windows: [{ startHour: 23, endHour: 7 }] } });
  assert.equal(c.temporal.timeFrame, '18:00-24:00');
  assert.equal(c.temporal.dayOfWeek, 1);
  assert.equal(c.temporal.isUserDefinedRestPeriod, true);
  assert.equal(c.referenceEventId, ev.id);
  assert.equal(c.timestamp, at);
});

test('activeSubjectDurationMs measures continuous foreground time of the current app', () => {
  resetEventIds();
  const t = Date.UTC(2026, 0, 5, 10, 0, 0);
  const history = [
    screen('Unlocked', t),
    app('Foreground', 'hash:a', t + 1_000),
    input('scroll', t + 60_000),
  ];
  const probe = input('scroll', t + 25 * 60_000);
  const c = buildContext(probe, [...history, probe], ids());
  assert.equal(c.sequence.activeSubjectDurationMs, 25 * 60_000 - 1_000);
});

test('a Background transition for the current app resets its active duration to 0', () => {
  resetEventIds();
  const t = Date.UTC(2026, 0, 5, 10, 0, 0);
  const history = [
    screen('Unlocked', t),
    app('Foreground', 'hash:a', t + 1_000),
    app('Background', 'hash:a', t + 2_000),
  ];
  const probe = input('scroll', t + 3_000);
  const c = buildContext(probe, [...history, probe], ids());
  assert.equal(c.sequence.activeSubjectDurationMs, 0);
});

test('eventsInLastWindow counts only events inside the recent window', () => {
  resetEventIds();
  const t = Date.UTC(2026, 0, 5, 10, 0, 0);
  const events = [
    screen('Unlocked', t),
    input('scroll', t + 10_000), // well before the window -> excluded
    input('scroll', t + 200_000), // inside [t+190s, t+250s]
    input('scroll', t + 240_000), // inside
  ];
  const probe = input('scroll', t + 250_000); // the probe itself is inside
  const c = buildContext(probe, [...events, probe], ids(), { recentWindowMs: 60_000 });
  assert.equal(c.sequence.eventsInLastWindow, 3);
});

test('elapsedSinceLastUnlockMs is measured from the most recent Unlocked event', () => {
  resetEventIds();
  const t = Date.UTC(2026, 0, 5, 10, 0, 0);
  const events = [screen('Unlocked', t), screen('Locked', t + 60_000), screen('Unlocked', t + 120_000)];
  const probe = input('scroll', t + 150_000);
  const c = buildContext(probe, [...events, probe], ids());
  assert.equal(c.sequence.elapsedSinceLastUnlockMs, 30_000);
});
