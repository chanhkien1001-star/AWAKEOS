/**
 * STAGE 2 — [CONTEXT]   (pure, state-free)
 *
 * `buildContext` is a pure function: (event, preceding events, config) -> Context.
 * It computes only structural / temporal facts. It never decides that a period is
 * "rest" — that boundary comes from user config (`restPeriods`). I-02.
 */

import type { Context, TimeFrameBoundary } from '../contracts/context.contract.ts';
import { CONTEXT_SCHEMA_VERSION } from '../contracts/context.contract.ts';
import type { Event } from '../contracts/event.contract.ts';
import type { IdFactory } from '../util/id.ts';

export interface RestPeriodConfig {
  /** Half-open [startHour, endHour) in local time; may wrap midnight (e.g. 23->7). */
  readonly windows: readonly { readonly startHour: number; readonly endHour: number }[];
}

export interface ContextBuilderOptions {
  /** Width of the "last window" used for `eventsInLastWindow`. Default 60_000ms. */
  readonly recentWindowMs?: number;
  /** User-configured rest periods. Absent => `isUserDefinedRestPeriod` is always false. */
  readonly restPeriods?: RestPeriodConfig;
}

function timeFrameOf(hour: number): TimeFrameBoundary {
  if (hour < 6) return '00:00-06:00';
  if (hour < 12) return '06:00-12:00';
  if (hour < 18) return '12:00-18:00';
  return '18:00-24:00';
}

/** ISO-8601 day of week: Monday = 1 ... Sunday = 7. */
function isoDayOfWeek(date: Date): number {
  const js = date.getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

function inRestPeriod(hour: number, cfg: RestPeriodConfig | undefined): boolean {
  if (!cfg) return false;
  return cfg.windows.some(({ startHour, endHour }) =>
    startHour <= endHour
      ? hour >= startHour && hour < endHour
      : hour >= startHour || hour < endHour, // wraps midnight
  );
}

function isUnlock(e: Event): boolean {
  return e.type === 'ScreenStateChanged' && 'state' in e.payload && e.payload.state === 'Unlocked';
}

function foregroundHash(e: Event): string | null {
  if (e.type !== 'ApplicationStateChanged') return null;
  if (!('state' in e.payload) || e.payload.state !== 'Foreground') return null;
  return 'packageNameHash' in e.payload ? e.payload.packageNameHash : null;
}

export function buildContext(
  event: Event,
  precedingEvents: readonly Event[],
  ids: IdFactory,
  opts: ContextBuilderOptions = {},
): Context {
  const recentWindowMs = opts.recentWindowMs ?? 60_000;
  const at = event.occurredAt;
  const date = new Date(at);
  const hour = date.getUTCHours();

  // chronological history strictly before `event`
  const history = precedingEvents.filter((e) => e.occurredAt <= at);

  const eventsInLastWindow = history.filter((e) => e.occurredAt >= at - recentWindowMs).length;

  const lastUnlock = [...history].reverse().find(isUnlock);
  const elapsedSinceLastUnlockMs = lastUnlock ? at - lastUnlock.occurredAt : 0;

  // Active subject = the app currently in the foreground. For an app event that
  // is the event's own subject; for any other event (e.g. an input) it is the
  // most recent app to enter the foreground.
  const reversedHistory = [...history].reverse();
  const currentHash =
    foregroundHash(event) ??
    (event.subject.type === 'Application' ? (event.subject.id ?? null) : null) ??
    (() => {
      const lastFg = reversedHistory.find((e) => foregroundHash(e) !== null);
      return lastFg ? foregroundHash(lastFg) : null;
    })();

  let activeSubjectDurationMs = 0;
  if (currentHash) {
    const enteredForeground = reversedHistory.find((e) => foregroundHash(e) === currentHash);
    const leftForeground = reversedHistory.find(
      (e) =>
        e.type === 'ApplicationStateChanged' &&
        'packageNameHash' in e.payload &&
        e.payload.packageNameHash === currentHash &&
        'state' in e.payload &&
        (e.payload.state === 'Background' || e.payload.state === 'Terminated'),
    );
    const stillForeground =
      enteredForeground !== undefined &&
      (leftForeground === undefined || leftForeground.occurredAt < enteredForeground.occurredAt);
    if (stillForeground) activeSubjectDurationMs = at - enteredForeground.occurredAt;
  }

  return {
    id: ids.uuid(),
    timestamp: at,
    referenceEventId: event.id,
    temporal: {
      timeFrame: timeFrameOf(hour),
      dayOfWeek: isoDayOfWeek(date),
      isUserDefinedRestPeriod: inRestPeriod(hour, opts.restPeriods),
    },
    sequence: {
      eventsInLastWindow,
      elapsedSinceLastUnlockMs,
      activeSubjectDurationMs,
    },
    schemaVersion: CONTEXT_SCHEMA_VERSION,
  };
}
