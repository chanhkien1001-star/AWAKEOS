/**
 * A consent gate in front of an `EventSource` (I-09).
 *
 * `ApplicationStateChanged` events for an app the person has not opted to observe
 * are dropped before they reach the pipeline. Screen and explicit-input events
 * always pass — they carry no app identity. When the mode is `all`, everything
 * passes.
 *
 * The allow-list is resolved lazily (`getAllowed`) so a settings change takes
 * effect on the next `pull()` without rebuilding anything.
 */

import type { Event, EventSource } from '@awake-os/core';

export type ObservedAppsConsent =
  | { readonly mode: 'all' }
  | { readonly mode: 'allowlist'; readonly allow: readonly string[] };

function appHash(e: Event): string | null {
  if (e.type !== 'ApplicationStateChanged') return null;
  return 'packageNameHash' in e.payload ? e.payload.packageNameHash : null;
}

export function createConsentFilteredEventSource(
  inner: EventSource,
  getConsent: () => ObservedAppsConsent | Promise<ObservedAppsConsent>,
): EventSource {
  return {
    async pull() {
      const events = await inner.pull();
      const consent = await getConsent();
      if (consent.mode === 'all') return events;
      const allow = new Set(consent.allow);
      return events.filter((e) => {
        const hash = appHash(e);
        return hash === null || allow.has(hash);
      });
    },
  };
}
