/**
 * Test helpers — deterministic Event builders. Timestamps are explicit; ids come
 * from a sequential factory so assertions are stable.
 */

import type { Event } from '../src/contracts/event.contract.ts';
import { EVENT_SCHEMA_VERSION } from '../src/contracts/event.contract.ts';
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
