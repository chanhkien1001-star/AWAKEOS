/**
 * STAGE 3 support — the behavioural baseline   (pure, state-free, local-first)
 *
 * A `BehavioralBaseline` is a rolling statistical summary of the PERSON'S OWN
 * usage, bucketed by time-of-day frame. Stage 3 compares a live observation
 * against it to answer "is this unusual *for you*?" instead of applying a global
 * threshold.
 *
 * Invariants:
 *  - I-02: every number here is a structural measurement (durations, counts,
 *    rates). There is no score, no label, no "healthy range".
 *  - I-09: computed from locally-stored events and kept on-device. `computeBaseline`
 *    is a pure reducer — the caller owns persistence and when to recompute.
 *  - I-07: naming describes structure only.
 *
 * Incremental / time-decayed updates are a later optimisation; for now the
 * baseline is recomputed from a trailing window of sessions.
 */

import type { TimeFrameBoundary } from '../contracts/context.contract.ts';
import type { Event } from '../contracts/event.contract.ts';
import { segmentSessions, type SessionSegmenterConfig, type UsageSession } from './session-segmenter.ts';

export const BASELINE_SCHEMA_VERSION = '1.0.0' as const;

const TIME_FRAMES: readonly TimeFrameBoundary[] = ['00:00-06:00', '06:00-12:00', '12:00-18:00', '18:00-24:00'];

/** Robust summary of one metric's distribution. `spread` ≈ a robust sigma (1.4826·MAD). */
export interface DistributionSummary {
  readonly n: number;
  readonly mean: number;
  readonly stdDev: number;
  readonly median: number;
  readonly spread: number;
  readonly p90: number;
  readonly max: number;
}

export interface TimeFrameBaseline {
  /** Number of sessions behind this bucket. */
  readonly observations: number;
  readonly sessionDurationMs: DistributionSummary;
  readonly appTransitionsPerMinute: DistributionSummary;
  readonly eventsPerMinute: DistributionSummary;
  readonly repeatedInputRun: DistributionSummary;
}

export interface BehavioralBaseline {
  readonly schemaVersion: string;
  readonly computedAt: number;
  /** Trailing window the sessions were drawn from. */
  readonly coverageDays: number;
  readonly totalSessions: number;
  readonly byTimeFrame: Readonly<Record<TimeFrameBoundary, TimeFrameBaseline>>;
}

export interface ComputeBaselineOptions {
  readonly now: number;
  /** Only sessions started within this trailing window count. Default 30. */
  readonly coverageDays?: number;
  readonly segmenter?: SessionSegmenterConfig;
}

const EMPTY_SUMMARY: DistributionSummary = Object.freeze({
  n: 0, mean: 0, stdDev: 0, median: 0, spread: 0, p90: 0, max: 0,
});

function summarize(values: readonly number[]): DistributionSummary {
  const n = values.length;
  if (n === 0) return EMPTY_SUMMARY;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const quantile = (q: number): number => {
    if (n === 1) return sorted[0]!;
    const pos = q * (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
  };
  const median = quantile(0.5);
  const absDev = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = absDev[Math.floor(absDev.length / 2)] ?? 0;

  return {
    n,
    mean,
    stdDev,
    median,
    spread: 1.4826 * mad,
    p90: quantile(0.9),
    max: sorted[n - 1]!,
  };
}

const perMinute = (count: number, durationMs: number): number => count / Math.max(durationMs / 60_000, 1 / 60_000);

function bucket(sessions: readonly UsageSession[]): TimeFrameBaseline {
  return {
    observations: sessions.length,
    sessionDurationMs: summarize(sessions.map((s) => s.durationMs)),
    appTransitionsPerMinute: summarize(sessions.map((s) => perMinute(s.appTransitionCount, s.durationMs))),
    eventsPerMinute: summarize(sessions.map((s) => perMinute(s.eventCount, s.durationMs))),
    repeatedInputRun: summarize(sessions.map((s) => s.maxRepeatedInputRun)),
  };
}

export function emptyBaseline(now: number, coverageDays = 30): BehavioralBaseline {
  const empty = bucket([]);
  return {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    computedAt: now,
    coverageDays,
    totalSessions: 0,
    byTimeFrame: { '00:00-06:00': empty, '06:00-12:00': empty, '12:00-18:00': empty, '18:00-24:00': empty },
  };
}

export function computeBaseline(
  sessions: readonly UsageSession[],
  opts: ComputeBaselineOptions,
): BehavioralBaseline {
  const coverageDays = opts.coverageDays ?? 30;
  const cutoff = opts.now - coverageDays * 24 * 60 * 60_000;
  const inWindow = sessions.filter((s) => s.startedAt >= cutoff);

  const byTimeFrame = {} as Record<TimeFrameBoundary, TimeFrameBaseline>;
  for (const tf of TIME_FRAMES) {
    byTimeFrame[tf] = bucket(inWindow.filter((s) => s.timeFrame === tf));
  }

  return {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    computedAt: opts.now,
    coverageDays,
    totalSessions: inWindow.length,
    byTimeFrame,
  };
}

/** Convenience: segment a raw event window and summarise it in one call. */
export function buildBaselineFromEvents(
  events: readonly Event[],
  opts: ComputeBaselineOptions,
): BehavioralBaseline {
  return computeBaseline(segmentSessions(events, opts.segmenter), opts);
}
