/**
 * STAGE 3 — [PATTERN]   (pure, state-free)   ***baseline-aware***
 *
 * `detectPatterns` compares a live observation against the person's own
 * `BehavioralBaseline` for the current time-of-day frame and emits a `Pattern`
 * only when the observation sits far enough into the tail of *their* usual
 * distribution — and clears an absolute floor so trivial values never count.
 *
 * `confidenceScore` reflects BOTH how far into the tail the observation sits and
 * how much data the baseline has (`maturity`). A thin baseline yields low
 * confidence, which downstream reads as epistemic uncertainty and tends toward
 * Silence (I-02 / I-04). With no usable baseline the detector falls back to
 * conservative cold-start thresholds and caps confidence hard.
 *
 * `deviationFromBaselineRatio` = observed / baseline centre (median). It is a
 * structural ratio, never a verdict. Every `structuralName` passes
 * `assertStructuralName` (I-11).
 */

import type { Context } from '../contracts/context.contract.ts';
import type { Event } from '../contracts/event.contract.ts';
import type { Pattern, PatternCategory } from '../contracts/pattern.contract.ts';
import { PATTERN_SCHEMA_VERSION } from '../contracts/pattern.contract.ts';
import { assertStructuralName } from '../invariants/invariants.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';
import type { BehavioralBaseline, DistributionSummary } from './baseline.ts';

export interface PatternDetectorConfig {
  /** Below this confidence, no Pattern is emitted. */
  readonly minConfidenceToEmit: number;
  /** Baseline buckets with fewer observations than this run in cold-start mode. */
  readonly baselineMinObservations: number;
  /** Observations needed for a baseline bucket to be treated as fully mature. */
  readonly maturityTargetObservations: number;
  /** Hard ceiling on confidence while in cold-start mode. */
  readonly coldStartConfidenceCap: number;
  /** Logistic tail parameters: centre (`z0`) and slope (`k`) over robust z-score. */
  readonly tail: { readonly z0: number; readonly k: number };
  /** Absolute minimums an observation must exceed regardless of baseline. */
  readonly floors: {
    readonly extendedDurationMs: number;
    readonly rapidTransitionsPerMinute: number;
    readonly rapidTransitionMinCount: number;
    readonly eventsPerMinute: number;
    readonly repeatedInputRun: number;
  };
  /** Thresholds used when the baseline bucket is not yet mature. */
  readonly coldStart: {
    readonly extendedDurationMs: number;
    readonly rapidTransitionsPerMinute: number;
    readonly eventsPerMinute: number;
    readonly repeatedInputRun: number;
  };
  /** Window (ending at Context.timestamp) for counting foreground switches. */
  readonly transitionWindowMs: number;
}

export const DEFAULT_PATTERN_CONFIG: PatternDetectorConfig = Object.freeze({
  minConfidenceToEmit: 0.15,
  baselineMinObservations: 8,
  maturityTargetObservations: 20,
  coldStartConfidenceCap: 0.35,
  tail: { z0: 1.5, k: 1.0 },
  floors: {
    extendedDurationMs: 10 * 60_000,
    rapidTransitionsPerMinute: 4,
    rapidTransitionMinCount: 5,
    eventsPerMinute: 12,
    repeatedInputRun: 5,
  },
  coldStart: {
    extendedDurationMs: 25 * 60_000,
    rapidTransitionsPerMinute: 6,
    eventsPerMinute: 20,
    repeatedInputRun: 5,
  },
  transitionWindowMs: 60_000,
});

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const logistic = (z: number, z0: number, k: number) => 1 / (1 + Math.exp(-(z - z0) / k));

function foregroundHash(e: Event): string | null {
  if (e.type !== 'ApplicationStateChanged') return null;
  if (!('state' in e.payload) || e.payload.state !== 'Foreground') return null;
  return 'packageNameHash' in e.payload ? e.payload.packageNameHash : null;
}
function actionIdOf(e: Event): string | null {
  return e.type === 'ExplicitInputReceived' && 'actionId' in e.payload ? e.payload.actionId : null;
}

interface Scored {
  readonly deviationRatio: number;
  readonly confidence: number;
}

/** Score one observation against its baseline distribution + a cold-start threshold. */
function score(
  observed: number,
  summary: DistributionSummary,
  coldStartThreshold: number,
  cfg: PatternDetectorConfig,
): Scored {
  const mature = summary.n >= cfg.baselineMinObservations;

  if (!mature) {
    if (observed < coldStartThreshold) return { deviationRatio: observed / Math.max(coldStartThreshold, 1), confidence: 0 };
    const excess = coldStartThreshold > 0 ? (observed - coldStartThreshold) / coldStartThreshold : 1;
    return {
      deviationRatio: coldStartThreshold > 0 ? observed / coldStartThreshold : 1,
      confidence: Math.min(cfg.coldStartConfidenceCap, clamp01(excess)),
    };
  }

  const centre = summary.median;
  // Floor the spread so a bucket with near-zero variance doesn't make z explode.
  const spread = Math.max(summary.spread, centre * 0.15, 1e-6);
  const z = (observed - centre) / spread;
  const maturity = clamp01(summary.n / cfg.maturityTargetObservations);
  const tail = logistic(z, cfg.tail.z0, cfg.tail.k);
  return {
    deviationRatio: observed / Math.max(centre, 1e-6),
    confidence: clamp01(maturity * tail),
  };
}

function make(
  category: PatternCategory,
  structuralName: string,
  metrics: Pattern['metrics'],
  confidenceScore: number,
  supportingEventIds: readonly string[],
  ids: IdFactory,
  clock: Clock,
): Pattern {
  assertStructuralName(structuralName); // I-11 guard
  return {
    id: ids.uuid(),
    detectedAt: clock.now(),
    category,
    structuralName,
    metrics,
    confidenceScore: clamp01(confidenceScore),
    supportingEventIds,
    schemaVersion: PATTERN_SCHEMA_VERSION,
  };
}

export function detectPatterns(
  events: readonly Event[],
  context: Context,
  baseline: BehavioralBaseline,
  ids: IdFactory,
  clock: Clock,
  config: PatternDetectorConfig = DEFAULT_PATTERN_CONFIG,
): readonly Pattern[] {
  const out: Pattern[] = [];
  const now = context.timestamp;
  const tf = baseline.byTimeFrame[context.temporal.timeFrame];
  const chronological = [...events].sort((a, b) => a.occurredAt - b.occurredAt);

  const emit = (s: Scored, floorOk: boolean): boolean =>
    floorOk && s.confidence >= config.minConfidenceToEmit;

  // --- ExtendedDuration: one subject held foreground unusually long ----------
  {
    const observed = context.sequence.activeSubjectDurationMs;
    const s = score(observed, tf.sessionDurationMs, config.coldStart.extendedDurationMs, config);
    if (emit(s, observed >= config.floors.extendedDurationMs)) {
      out.push(
        make(
          'ExtendedDuration',
          'ExtendedContinuousInteractionPattern',
          { eventDensity: 0, transitionCount: 0, totalDurationMs: observed, deviationFromBaselineRatio: s.deviationRatio },
          s.confidence,
          [context.referenceEventId],
          ids,
          clock,
        ),
      );
    }
  }

  // --- RapidTransition: many distinct foreground switches in a short span ----
  {
    const windowStart = now - config.transitionWindowMs;
    const switches = chronological.filter((e) => foregroundHash(e) !== null && e.occurredAt >= windowStart);
    const distinct = switches.filter(
      (e, i) => i === 0 || foregroundHash(e) !== foregroundHash(switches[i - 1]!),
    );
    if (distinct.length >= 2) {
      const spanMs = Math.max(1, now - distinct[0]!.occurredAt);
      const perMinute = distinct.length / (spanMs / 60_000);
      const s = score(perMinute, tf.appTransitionsPerMinute, config.coldStart.rapidTransitionsPerMinute, config);
      const floorOk =
        perMinute >= config.floors.rapidTransitionsPerMinute && distinct.length >= config.floors.rapidTransitionMinCount;
      if (emit(s, floorOk)) {
        out.push(
          make(
            'RapidTransition',
            'RapidRepeatedTransition',
            {
              eventDensity: perMinute,
              transitionCount: distinct.length,
              totalDurationMs: spanMs,
              deviationFromBaselineRatio: s.deviationRatio,
            },
            s.confidence,
            distinct.map((e) => e.id),
            ids,
            clock,
          ),
        );
      }
    }
  }

  // --- TemporalDensity: many events per minute in the recent window ---------
  {
    const perMinute = context.sequence.eventsInLastWindow; // Context window is 1 min by default
    const s = score(perMinute, tf.eventsPerMinute, config.coldStart.eventsPerMinute, config);
    if (emit(s, perMinute >= config.floors.eventsPerMinute)) {
      out.push(
        make(
          'TemporalDensity',
          'HighTemporalEventDensity',
          {
            eventDensity: perMinute,
            transitionCount: 0,
            totalDurationMs: 60_000,
            deviationFromBaselineRatio: s.deviationRatio,
          },
          s.confidence,
          chronological.slice(-Math.max(1, Math.round(perMinute))).map((e) => e.id),
          ids,
          clock,
        ),
      );
    }
  }

  // --- Repetition: the same discrete input repeated in a long run ----------
  {
    let bestRun = 0;
    let bestIds: string[] = [];
    let run: string[] = [];
    let prev: string | null = null;
    for (const e of chronological) {
      const a = actionIdOf(e);
      if (a === null) {
        if (e.type !== 'ScreenStateChanged') { prev = null; run = []; }
        continue;
      }
      run = a === prev ? [...run, e.id] : [e.id];
      prev = a;
      if (run.length > bestRun) { bestRun = run.length; bestIds = [...run]; }
    }
    if (bestRun >= 2) {
      const s = score(bestRun, tf.repeatedInputRun, config.coldStart.repeatedInputRun, config);
      if (emit(s, bestRun >= config.floors.repeatedInputRun)) {
        out.push(
          make(
            'Repetition',
            'RepeatedDiscreteInputPattern',
            { eventDensity: bestRun, transitionCount: bestRun, totalDurationMs: 0, deviationFromBaselineRatio: s.deviationRatio },
            s.confidence,
            bestIds,
            ids,
            clock,
          ),
        );
      }
    }
  }

  return out;
}
