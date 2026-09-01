/**
 * STAGE 3 — [PATTERN]   (pure, state-free)   ***STUB LOGIC***
 *
 * `detectPatterns` is a pure function over an Event window + its Context. The
 * shapes it returns are final (Pattern contract is FROZEN); the *thresholds and
 * scoring below are placeholders* to be replaced in Implementation Step 2 with
 * baseline-aware detection.
 *
 * Every `structuralName` is run through `assertStructuralName` (I-11) so no
 * interpretive name can ever leak in, even from future edits.
 */

import type { Context } from '../contracts/context.contract.ts';
import type { Event } from '../contracts/event.contract.ts';
import type { Pattern, PatternCategory } from '../contracts/pattern.contract.ts';
import { PATTERN_SCHEMA_VERSION } from '../contracts/pattern.contract.ts';
import { assertStructuralName } from '../invariants/invariants.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';

export interface PatternDetectorConfig {
  /** Min foreground app switches inside `transitionWindowMs` to flag RapidTransition. */
  readonly rapidTransitionCount: number;
  readonly transitionWindowMs: number;
  /** Min continuous foreground time on one subject to flag ExtendedDuration. */
  readonly extendedDurationMs: number;
  /** Min events inside Context.recentWindow to flag TemporalDensity. */
  readonly temporalDensityCount: number;
  /** Min identical `actionId` repeats to flag Repetition. */
  readonly repetitionCount: number;
}

export const DEFAULT_PATTERN_CONFIG: PatternDetectorConfig = Object.freeze({
  rapidTransitionCount: 6,
  transitionWindowMs: 60_000,
  extendedDurationMs: 25 * 60_000,
  temporalDensityCount: 20,
  repetitionCount: 5,
});

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function foregroundHash(e: Event): string | null {
  if (e.type !== 'ApplicationStateChanged') return null;
  if (!('state' in e.payload) || e.payload.state !== 'Foreground') return null;
  return 'packageNameHash' in e.payload ? e.payload.packageNameHash : null;
}

function actionId(e: Event): string | null {
  if (e.type !== 'ExplicitInputReceived') return null;
  return 'actionId' in e.payload ? e.payload.actionId : null;
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
  assertStructuralName(structuralName); // I-11 guard — throws on interpretive names
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
  ids: IdFactory,
  clock: Clock,
  config: PatternDetectorConfig = DEFAULT_PATTERN_CONFIG,
): readonly Pattern[] {
  const out: Pattern[] = [];
  const now = context.timestamp;
  const chronological = [...events].sort((a, b) => a.occurredAt - b.occurredAt);

  // --- RapidTransition: many foreground switches in a short span ------------
  const switches = chronological.filter(
    (e) => foregroundHash(e) !== null && e.occurredAt >= now - config.transitionWindowMs,
  );
  const distinctInOrder = switches.filter((e, i) => i === 0 || foregroundHash(e) !== foregroundHash(switches[i - 1]!));
  if (distinctInOrder.length >= config.rapidTransitionCount) {
    const span = Math.max(1, now - (distinctInOrder[0]?.occurredAt ?? now));
    out.push(
      make(
        'RapidTransition',
        'RapidRepeatedTransition',
        {
          eventDensity: distinctInOrder.length / (span / 1000),
          transitionCount: distinctInOrder.length,
          totalDurationMs: span,
          deviationFromBaselineRatio: distinctInOrder.length / config.rapidTransitionCount,
        },
        distinctInOrder.length / (config.rapidTransitionCount * 2),
        distinctInOrder.map((e) => e.id),
        ids,
        clock,
      ),
    );
  }

  // --- ExtendedDuration: one subject held foreground a long time -----------
  if (context.sequence.activeSubjectDurationMs >= config.extendedDurationMs) {
    const d = context.sequence.activeSubjectDurationMs;
    out.push(
      make(
        'ExtendedDuration',
        'ExtendedContinuousInteractionPattern',
        {
          eventDensity: 0,
          transitionCount: 0,
          totalDurationMs: d,
          deviationFromBaselineRatio: d / config.extendedDurationMs,
        },
        (d - config.extendedDurationMs) / config.extendedDurationMs,
        [context.referenceEventId],
        ids,
        clock,
      ),
    );
  }

  // --- TemporalDensity: many events in the recent window ------------------
  if (context.sequence.eventsInLastWindow >= config.temporalDensityCount) {
    const c = context.sequence.eventsInLastWindow;
    out.push(
      make(
        'TemporalDensity',
        'HighTemporalEventDensity',
        {
          eventDensity: c,
          transitionCount: 0,
          totalDurationMs: 60_000,
          deviationFromBaselineRatio: c / config.temporalDensityCount,
        },
        (c - config.temporalDensityCount) / config.temporalDensityCount,
        chronological.slice(-c).map((e) => e.id),
        ids,
        clock,
      ),
    );
  }

  // --- Repetition: same discrete input repeated -------------------------
  const counts = new Map<string, string[]>();
  for (const e of chronological) {
    const a = actionId(e);
    if (a === null) continue;
    (counts.get(a) ?? counts.set(a, []).get(a)!).push(e.id);
  }
  for (const [, evIds] of counts) {
    if (evIds.length >= config.repetitionCount) {
      out.push(
        make(
          'Repetition',
          'RepeatedDiscreteInputPattern',
          {
            eventDensity: evIds.length,
            transitionCount: evIds.length,
            totalDurationMs: 0,
            deviationFromBaselineRatio: evIds.length / config.repetitionCount,
          },
          evIds.length / (config.repetitionCount * 2),
          evIds,
          ids,
          clock,
        ),
      );
    }
  }

  return out;
}
