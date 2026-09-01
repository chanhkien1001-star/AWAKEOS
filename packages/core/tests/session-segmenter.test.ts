import test from 'node:test';
import assert from 'node:assert/strict';

import { segmentSessions } from '../src/engines/session-segmenter.ts';
import { app, input, screen, resetEventIds } from './helpers.ts';

const T0 = Date.UTC(2026, 2, 3, 20, 0, 0); // Tue 20:00 UTC

test('segments a single unlock -> lock span with structural counts', () => {
  resetEventIds();
  const events = [
    screen('Unlocked', T0),
    app('Foreground', 'hash:a', T0 + 1_000),
    input('scroll', T0 + 2_000),
    input('scroll', T0 + 3_000),
    input('tap', T0 + 4_000),
    app('Foreground', 'hash:b', T0 + 5_000),
    screen('Locked', T0 + 6_000),
  ];
  const [s, ...rest] = segmentSessions(events);
  assert.equal(rest.length, 0);
  assert.equal(s!.durationMs, 6_000);
  assert.equal(s!.timeFrame, '18:00-24:00');
  assert.equal(s!.dayOfWeek, 2);
  assert.equal(s!.appTransitionCount, 1); // a -> b
  assert.equal(s!.maxRepeatedInputRun, 2); // scroll, scroll
  assert.equal(s!.openEnded, false);
});

test('an idle gap longer than maxGapMs closes the session at the last activity', () => {
  resetEventIds();
  const events = [
    screen('Unlocked', T0),
    input('scroll', T0 + 1_000),
    // ~10 min of nothing
    input('scroll', T0 + 1_000 + 10 * 60_000),
    screen('Locked', T0 + 2_000 + 10 * 60_000),
  ];
  const sessions = segmentSessions(events, { maxGapMs: 5 * 60_000, minSessionMs: 1_000 });
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0]!.endedAt, T0 + 1_000); // closed at last activity, not at the gap end
  assert.equal(sessions[0]!.openEnded, true);
  assert.equal(sessions[1]!.openEnded, false);
});

test('a stream that never locks yields one open-ended session', () => {
  resetEventIds();
  const events = [screen('Unlocked', T0), app('Foreground', 'hash:a', T0 + 1_000), input('scroll', T0 + 2_000)];
  const [s] = segmentSessions(events);
  assert.equal(s!.openEnded, true);
  assert.equal(s!.endedAt, T0 + 2_000);
});

test('sub-minimum sessions are dropped', () => {
  resetEventIds();
  const events = [screen('Unlocked', T0), screen('Locked', T0 + 200)];
  assert.equal(segmentSessions(events, { maxGapMs: 5 * 60_000, minSessionMs: 1_000 }).length, 0);
});

test('longest repeated-input run is found even when broken by other inputs', () => {
  resetEventIds();
  const events = [
    screen('Unlocked', T0),
    input('scroll', T0 + 1_000),
    input('scroll', T0 + 2_000),
    input('tap', T0 + 3_000),
    input('scroll', T0 + 4_000),
    input('scroll', T0 + 5_000),
    input('scroll', T0 + 6_000),
    input('scroll', T0 + 7_000),
    screen('Locked', T0 + 8_000),
  ];
  assert.equal(segmentSessions(events)[0]!.maxRepeatedInputRun, 4);
});
