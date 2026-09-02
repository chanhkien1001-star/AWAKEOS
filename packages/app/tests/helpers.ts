/** Minimal deterministic Event builders for @awake-os/app tests. */

import type { Event } from '@awake-os/core';

let seq = 0;
const nextId = () => `aev-${++seq}`;
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
    schemaVersion: '1.0.0',
  };
}

export function app(state: 'Foreground' | 'Background' | 'Terminated', packageNameHash: string, occurredAt: number): Event {
  return {
    id: nextId(),
    occurredAt,
    type: 'ApplicationStateChanged',
    source: { type: 'System', id: 'os' },
    subject: { type: 'Application', id: packageNameHash },
    payload: { state, packageNameHash },
    schemaVersion: '1.0.0',
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
    schemaVersion: '1.0.0',
  };
}
