/**
 * STAGE 2/3 support — session segmentation   (pure, state-free)
 *
 * `segmentSessions` folds a raw `Event` stream into `UsageSession` summaries: the
 * span between an unlock (or first foreground) and the next lock / screen-off /
 * long idle gap. It is the raw material the baseline is computed from.
 *
 * It reports STRUCTURE ONLY (I-02): when a session started/ended, how long it
 * ran, how many app switches and events it contained, the longest run of one
 * repeated input. No labels, no scoring, no meaning.
 */

import type { TimeFrameBoundary } from '../contracts/context.contract.ts';
import type { Event } from '../contracts/event.contract.ts';

export interface UsageSession {
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
  readonly timeFrame: TimeFrameBoundary;
  readonly dayOfWeek: number; // ISO 1-7
  /** Foreground entries whose app differs from the previous foreground app. */
  readonly appTransitionCount: number;
  /** Every event that fell inside [startedAt, endedAt]. */
  readonly eventCount: number;
  /** Longest run of consecutive ExplicitInputReceived with the same actionId. */
  readonly maxRepeatedInputRun: number;
  /** True when the stream ended before an explicit lock/off closed the session. */
  readonly openEnded: boolean;
}

export interface SessionSegmenterConfig {
  /** A gap longer than this between consecutive events closes the session. Default 5min. */
  readonly maxGapMs: number;
  /** Sessions shorter than this are dropped as noise. Default 1s. */
  readonly minSessionMs: number;
}

export const DEFAULT_SESSION_SEGMENTER_CONFIG: SessionSegmenterConfig = Object.freeze({
  maxGapMs: 5 * 60_000,
  minSessionMs: 1_000,
});

function timeFrameOf(hour: number): TimeFrameBoundary {
  if (hour < 6) return '00:00-06:00';
  if (hour < 12) return '06:00-12:00';
  if (hour < 18) return '12:00-18:00';
  return '18:00-24:00';
}
function isoDayOfWeek(ms: number): number {
  const js = new Date(ms).getUTCDay();
  return js === 0 ? 7 : js;
}
function isUnlock(e: Event): boolean {
  return e.type === 'ScreenStateChanged' && 'state' in e.payload && e.payload.state === 'Unlocked';
}
function isSessionEnd(e: Event): boolean {
  return (
    e.type === 'ScreenStateChanged' &&
    'state' in e.payload &&
    (e.payload.state === 'Locked' || e.payload.state === 'Off')
  );
}
function foregroundHash(e: Event): string | null {
  if (e.type !== 'ApplicationStateChanged') return null;
  if (!('state' in e.payload) || e.payload.state !== 'Foreground') return null;
  return 'packageNameHash' in e.payload ? e.payload.packageNameHash : null;
}
function actionIdOf(e: Event): string | null {
  return e.type === 'ExplicitInputReceived' && 'actionId' in e.payload ? e.payload.actionId : null;
}

interface OpenSession {
  startedAt: number;
  lastEventAt: number;
  events: Event[];
}

function summarize(open: OpenSession, endedAt: number, openEnded: boolean, cfg: SessionSegmenterConfig): UsageSession | null {
  const durationMs = endedAt - open.startedAt;
  if (durationMs < cfg.minSessionMs) return null;

  let appTransitionCount = 0;
  let prevFg: string | null = null;
  let maxRepeatedInputRun = 0;
  let curRun = 0;
  let prevAction: string | null = null;

  for (const e of open.events) {
    const fg = foregroundHash(e);
    if (fg !== null) {
      if (prevFg !== null && fg !== prevFg) appTransitionCount += 1;
      prevFg = fg;
    }
    const a = actionIdOf(e);
    if (a !== null) {
      curRun = a === prevAction ? curRun + 1 : 1;
      prevAction = a;
      if (curRun > maxRepeatedInputRun) maxRepeatedInputRun = curRun;
    } else if (e.type !== 'ScreenStateChanged') {
      // a non-input, non-screen event breaks an input run
      prevAction = null;
      curRun = 0;
    }
  }

  return {
    startedAt: open.startedAt,
    endedAt,
    durationMs,
    timeFrame: timeFrameOf(new Date(open.startedAt).getUTCHours()),
    dayOfWeek: isoDayOfWeek(open.startedAt),
    appTransitionCount,
    eventCount: open.events.length,
    maxRepeatedInputRun,
    openEnded,
  };
}

export function segmentSessions(
  events: readonly Event[],
  config: SessionSegmenterConfig = DEFAULT_SESSION_SEGMENTER_CONFIG,
): readonly UsageSession[] {
  const chronological = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const sessions: UsageSession[] = [];
  let open: OpenSession | null = null;

  const close = (endedAt: number, openEnded: boolean) => {
    if (!open) return;
    const s = summarize(open, endedAt, openEnded, config);
    if (s) sessions.push(s);
    open = null;
  };

  for (const e of chronological) {
    if (open && e.occurredAt - open.lastEventAt > config.maxGapMs) {
      close(open.lastEventAt, true); // idle gap -> session ended at last activity
    }

    if (isSessionEnd(e)) {
      close(e.occurredAt, false);
      continue;
    }

    if (!open) {
      // open on an explicit unlock, or on the first foreground/input we see
      if (isUnlock(e) || foregroundHash(e) !== null || actionIdOf(e) !== null) {
        open = { startedAt: e.occurredAt, lastEventAt: e.occurredAt, events: [e] };
      }
      continue;
    }

    open.events.push(e);
    open.lastEventAt = e.occurredAt;
  }

  if (open) close((open as OpenSession).lastEventAt, true);
  return sessions;
}
