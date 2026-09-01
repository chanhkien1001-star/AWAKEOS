/**
 * Test helpers — deterministic Event builders. Timestamps are explicit; ids come
 * from a sequential factory so assertions are stable.
 */

import type { Event } from '../src/contracts/event.contract.ts';
import { EVENT_SCHEMA_VERSION } from '../src/contracts/event.contract.ts';
import type { TimeFrameBoundary } from '../src/contracts/context.contract.ts';
import { computeBaseline, type BehavioralBaseline } from '../src/engines/baseline.ts';
import type { UsageSession } from '../src/engines/session-segmenter.ts';
import { sequentialIdFactory } from '../src/util/id.ts';

export const idf = () => sequentialIdFactory('t');

let seq = 0;
const nextId = () => `ev-${++seq}`;
export const resetEventIds = () => {
  seq = 0;
};

export function screen(state: 'On' | 'Off' | 'Unlocked' | 'Locked', occurredAt: number): Event {
  return {
    id: nextId(),
    occurredAt,
    type: 'ScreenStateChanged',
    source: { type: 'System', id: 'os' },
    subject: { type: 'Screen' },
    payload: { state },
    schemaVersion: EVENT_SCHEMA_VERSION,
  };
}

export function app(
  state: 'Foreground' | 'Background' | 'Terminated',
  packageNameHash: string,
  occurredAt: number,
): Event {
  return {
    id: nextId(),
    occurredAt,
    type: 'ApplicationStateChanged',
    source: { type: 'System', id: 'os' },
    subject: { type: 'Application', id: packageNameHash },
    payload: { state, packageNameHash },
    schemaVersion: EVENT_SCHEMA_VERSION,
  };
}

export function input(actionId: string, occurredAt: number, value?: string | number | boolean): Event {
  return {
    id: nextId(),
    occurredAt,
    type: 'ExplicitInputReceived',
    source: { type: 'User', id: 'user' },
    subject: { type: 'UserInput' },
    payload: value === undefined ? { actionId } : { actionId, value },
    schemaVersion: EVENT_SCHEMA_VERSION,
  };
}

/**
 * A long single-app session: Unlock, Foreground, then `scrolls` inputs over
 * `durationMs`. By default every input is `scroll` (which also trips the
 * Repetition detector); pass `actions` to cycle distinct action ids instead.
 */
export function longSession(opts: {
  startAt: number;
  packageNameHash: string;
  durationMs: number;
  scrolls: number;
  actions?: readonly string[];
}): Event[] {
  const { startAt, packageNameHash, durationMs, scrolls, actions = ['scroll'] } = opts;
  const events: Event[] = [screen('Unlocked', startAt), app('Foreground', packageNameHash, startAt + 1)];
  const gap = Math.max(1, Math.floor(durationMs / Math.max(1, scrolls)));
  for (let i = 1; i <= scrolls; i++) {
    events.push(input(actions[(i - 1) % actions.length]!, startAt + 1 + i * gap));
  }
  return events;
}

const HOUR_FOR_FRAME: Record<TimeFrameBoundary, number> = {
  '00:00-06:00': 3,
  '06:00-12:00': 9,
  '12:00-18:00': 15,
  '18:00-24:00': 20,
};
const JITTER = [0.82, 0.9, 0.97, 1.03, 1.1, 1.18];

/**
 * A mature `BehavioralBaseline` for one time frame, built by summarising a set of
 * synthetic sessions centred on the given medians (with deterministic jitter so
 * `spread` is non-zero). Other time frames are left empty.
 */
export function matureBaseline(opts: {
  now: number;
  timeFrame: TimeFrameBoundary;
  sessionMinutes?: number;
  appTransitionsPerMinute?: number;
  eventsPerMinute?: number;
  repeatedInputRun?: number;
  observations?: number;
}): BehavioralBaseline {
  const {
    now,
    timeFrame,
    sessionMinutes = 12,
    appTransitionsPerMinute = 0.4,
    eventsPerMinute = 6,
    repeatedInputRun = 3,
    observations = 30,
  } = opts;
  const hour = HOUR_FOR_FRAME[timeFrame];
  const day = 24 * 60 * 60_000;

  const sessions: UsageSession[] = Array.from({ length: observations }, (_, k) => {
    const j = JITTER[k % JITTER.length]!;
    const started = new Date(now - (k + 1) * day);
    started.setUTCHours(hour, 0, 0, 0);
    const startedAt = started.getTime();
    const durationMs = Math.round(sessionMinutes * 60_000 * j);
    const minutes = durationMs / 60_000;
    return {
      startedAt,
      endedAt: startedAt + durationMs,
      durationMs,
      timeFrame,
      dayOfWeek: ((new Date(startedAt).getUTCDay() + 6) % 7) + 1,
      appTransitionCount: Math.round(appTransitionsPerMinute * minutes * j),
      eventCount: Math.max(1, Math.round(eventsPerMinute * minutes * j)),
      maxRepeatedInputRun: Math.max(1, Math.round(repeatedInputRun * j)),
      openEnded: false,
    };
  });

  return computeBaseline(sessions, { now, coverageDays: observations + 5 });
}

/** Rapid switching between N apps, `switches` times, one every `everyMs`. */
export function rapidSwitching(opts: {
  startAt: number;
  apps: readonly string[];
  switches: number;
  everyMs: number;
}): Event[] {
  const { startAt, apps, switches, everyMs } = opts;
  const events: Event[] = [screen('Unlocked', startAt)];
  for (let i = 0; i < switches; i++) {
    const pkg = apps[i % apps.length]!;
    events.push(app('Foreground', pkg, startAt + 1 + i * everyMs));
  }
  return events;
}
