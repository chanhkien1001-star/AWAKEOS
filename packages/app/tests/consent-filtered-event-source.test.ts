import test from 'node:test';
import assert from 'node:assert/strict';

import type { Event, EventSource } from '@awake-os/core';
import { createConsentFilteredEventSource, type ObservedAppsConsent } from '../src/settings/consent-filtered-event-source.ts';
import { screen, app, input, resetEventIds } from './helpers.ts';

function fixedSource(events: readonly Event[]): EventSource {
  let done = false;
  return {
    async pull() {
      if (done) return [];
      done = true;
      return events;
    },
  };
}

test('mode "all" passes every event through', async () => {
  resetEventIds();
  const events = [screen('Unlocked', 1), app('Foreground', 'sha256:a', 2), input('scroll', 3)];
  const src = createConsentFilteredEventSource(fixedSource(events), () => ({ mode: 'all' }));
  assert.equal((await src.pull()).length, 3);
});

test('allowlist drops app events for non-consented apps, keeps screen + input', async () => {
  resetEventIds();
  const events = [
    screen('Unlocked', 1),
    app('Foreground', 'sha256:allowed', 2),
    app('Foreground', 'sha256:blocked', 3),
    input('scroll', 4),
  ];
  const consent: ObservedAppsConsent = { mode: 'allowlist', allow: ['sha256:allowed'] };
  const src = createConsentFilteredEventSource(fixedSource(events), () => consent);
  const out = await src.pull();
  assert.deepEqual(out.map((e) => e.type), ['ScreenStateChanged', 'ApplicationStateChanged', 'ExplicitInputReceived']);
  assert.equal((out[1] as { payload: { packageNameHash: string } }).payload.packageNameHash, 'sha256:allowed');
});

test('consent is re-read on each pull (a settings change takes effect next tick)', async () => {
  resetEventIds();
  let mode: ObservedAppsConsent = { mode: 'allowlist', allow: [] };
  const src = createConsentFilteredEventSource(
    {
      async pull() {
        return [app('Foreground', 'sha256:x', Date.now())];
      },
    },
    () => mode,
  );
  assert.equal((await src.pull()).length, 0); // blocked
  mode = { mode: 'all' };
  assert.equal((await src.pull()).length, 1); // now allowed
});
