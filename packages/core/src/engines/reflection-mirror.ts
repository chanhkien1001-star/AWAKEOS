/**
 * STAGE 8 — [REFLECTION]   (pure)
 *
 * `buildReflectionMirror` reconstructs a `ReflectionMirror` from persisted
 * `PatternObservation`s over a time range. It is a mirror and nothing more:
 * observable structural facts, grouped, counted, described neutrally.
 *
 * Invariants:
 *  - I-07 Reflection, Not Judgment — output passes `assertNoJudgment`; facts are
 *    ordered by time-of-day frame (a neutral structural order), NEVER by count
 *    (that would rank behaviours). No score, no streak, no "good / bad".
 *  - I-06 No Dependency Replacement — generated on demand from the local store,
 *    not a feed.
 *  - I-02 — a `PatternObservation` carries only structure (category, structural
 *    name, deviation ratio, when). It is the compact, persistable trace of a
 *    detected `Pattern`.
 */

import type { TimeFrameBoundary } from '../contracts/context.contract.ts';
import type { PatternCategory } from '../contracts/pattern.contract.ts';
import type { ReflectionMirror } from '../contracts/reflection.contract.ts';
import { assertNoJudgment, assertNonCoerciveText } from '../invariants/invariants.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';

/** The compact, persistable structural trace of one detected Pattern. */
export interface PatternObservation {
  readonly patternId: string;
  /** When the observed behaviour occurred (the Context timestamp) — used for range queries and retention. */
  readonly observedAt: number;
  readonly category: PatternCategory;
  readonly structuralName: string;
  readonly deviationFromBaselineRatio: number;
  readonly timeFrame: TimeFrameBoundary;
  readonly dayOfWeek: number; // ISO 1-7
  readonly isUserDefinedRestPeriod: boolean;
}

export interface ReflectionRequest {
  readonly observations: readonly PatternObservation[];
  readonly timeRangeStart: number;
  readonly timeRangeEnd: number;
}

const TIME_FRAME_ORDER: readonly TimeFrameBoundary[] = [
  '00:00-06:00',
  '06:00-12:00',
  '12:00-18:00',
  '18:00-24:00',
];

function dominantTimeFrame(frames: readonly TimeFrameBoundary[]): TimeFrameBoundary | null {
  if (frames.length === 0) return null;
  const tally = new Map<TimeFrameBoundary, number>();
  for (const f of frames) tally.set(f, (tally.get(f) ?? 0) + 1);
  // ties broken by earliest time frame, so the order is deterministic and neutral
  return [...tally.entries()].sort(
    (a, b) => b[1] - a[1] || TIME_FRAME_ORDER.indexOf(a[0]) - TIME_FRAME_ORDER.indexOf(b[0]),
  )[0]![0];
}

export function buildReflectionMirror(req: ReflectionRequest, ids: IdFactory, clock: Clock): ReflectionMirror {
  const inRange = req.observations.filter(
    (o) => o.observedAt >= req.timeRangeStart && o.observedAt < req.timeRangeEnd,
  );

  const byName = new Map<string, PatternObservation[]>();
  for (const o of inRange) {
    const bucket = byName.get(o.structuralName) ?? [];
    bucket.push(o);
    byName.set(o.structuralName, bucket);
  }

  const facts = [...byName.entries()].map(([patternName, group]) => {
    const dom = dominantTimeFrame(group.map((o) => o.timeFrame));
    const days = new Set(group.map((o) => o.dayOfWeek)).size;
    const inRest = group.some((o) => o.isUserDefinedRestPeriod);
    const where = dom ? `most often in the ${dom} time frame` : 'across the range';
    const rest = inRest ? ', including during a period you marked as rest' : '';
    const contextSummary = `Recorded ${where}, on ${days} day${days === 1 ? '' : 's'}${rest}.`;
    assertNonCoerciveText(contextSummary);
    return {
      patternName,
      occurrenceCount: group.length,
      contextSummary,
      _sortKey: dom ? TIME_FRAME_ORDER.indexOf(dom) : TIME_FRAME_ORDER.length,
    };
  });

  // Neutral order: by time-of-day frame, then name. Never by occurrenceCount.
  facts.sort((a, b) => a._sortKey - b._sortKey || a.patternName.localeCompare(b.patternName));

  const mirror: ReflectionMirror = {
    id: ids.uuid(),
    generatedAt: clock.now(),
    timeRangeStart: req.timeRangeStart,
    timeRangeEnd: req.timeRangeEnd,
    observableFacts: facts.map(({ patternName, occurrenceCount, contextSummary }) => ({
      patternName,
      occurrenceCount,
      contextSummary,
    })),
  };

  assertNoJudgment(mirror); // I-07 hard guard
  return mirror;
}
