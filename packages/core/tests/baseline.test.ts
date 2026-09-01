import test from 'node:test';
import assert from 'node:assert/strict';

import { assertNoJudgment } from '../src/invariants/invariants.ts';
import {
  BASELINE_SCHEMA_VERSION,
  buildBaselineFromEvents,
  computeBaseline,
  emptyBaseline,
} from '../src/engines/baseline.ts';
import type { UsageSession } from '../src/engines/session-segmenter.ts';
import { longSession, screen, resetEventIds } from './helpers.ts';

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);
const DAY = 24 * 60 * 60_000;

function session(startedAt: number, durationMs: number, extra: Partial<UsageSession> = {}): UsageSession {
  return {
    startedAt,
    endedAt: startedAt + durationMs,
    durationMs,
    timeFrame: '18:00-24:00',
    dayOfWeek: 3,
    appTransitionCount: 2,
    eventCount: 30,
    maxRepeatedInputRun: 4,
    openEnded: false,
    ...extra,
  };
}

test('emptyBaseline has zeroed buckets and the schema version', () => {
  const b = emptyBaseline(NOW);
  assert.equal(b.schemaVersion, BASELINE_SCHEMA_VERSION);
  assert.equal(b.totalSessions, 0);
  assert.equal(b.byTimeFrame['18:00-24:00'].observations, 0);
  assert.equal(b.byTimeFrame['18:00-24:00'].sessionDurationMs.n, 0);
});

test('computeBaseline summarises per time frame and ignores out-of-window sessions', () => {
  const sessions: UsageSession[] = [
    ...[10, 12, 11, 13, 12, 14, 10, 12].map((m, i) => session(NOW - (i + 1) * DAY, m * 60_000)),
    session(NOW - 90 * DAY, 99 * 60_000), // outside 30-day window -> excluded
    session(NOW - 2 * DAY, 8 * 60_000, { timeFrame: '06:00-12:00' }), // different bucket
  ];
  const b = computeBaseline(sessions, { now: NOW, coverageDays: 30 });

  const evening = b.byTimeFrame['18:00-24:00'];
  assert.equal(evening.observations, 8);
  assert.ok(evening.sessionDurationMs.median >= 11 * 60_000 && evening.sessionDurationMs.median <= 13 * 60_000);
  assert.ok(evening.sessionDurationMs.spread > 0);
  assert.equal(b.byTimeFrame['06:00-12:00'].observations, 1);
  assert.equal(b.totalSessions, 9);
});

test('a baseline carries no judgment-shaped fields (I-07)', () => {
  const b = computeBaseline([session(NOW - DAY, 12 * 60_000)], { now: NOW });
  assert.doesNotThrow(() => assertNoJudgment(b));
});

test('buildBaselineFromEvents turns a raw event window into a baseline', () => {
  resetEventIds();
  // three midday sessions (NOW is 12:00 UTC) on three different days
  const events = [
    ...longSession({ startAt: NOW - 3 * DAY, packageNameHash: 'hash:a', durationMs: 10 * 60_000, scrolls: 20 }),
    screen('Locked', NOW - 3 * DAY + 10 * 60_000 + 5_000),
    ...longSession({ startAt: NOW - 2 * DAY, packageNameHash: 'hash:a', durationMs: 12 * 60_000, scrolls: 20 }),
    screen('Locked', NOW - 2 * DAY + 12 * 60_000 + 5_000),
    ...longSession({ startAt: NOW - 1 * DAY, packageNameHash: 'hash:a', durationMs: 11 * 60_000, scrolls: 20 }),
    screen('Locked', NOW - 1 * DAY + 11 * 60_000 + 5_000),
  ];
  const b = buildBaselineFromEvents(events, { now: NOW, coverageDays: 30 });
  assert.equal(b.totalSessions, 3);
  const midday = b.byTimeFrame['12:00-18:00'];
  assert.equal(midday.observations, 3);
  assert.ok(midday.sessionDurationMs.median > 9 * 60_000);
});
