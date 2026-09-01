/**
 * STAGE 8 — [REFLECTION]   (pure)   ***STUB AGGREGATION***
 *
 * Builds a ReflectionMirror: observable facts over a time range, nothing else.
 *
 * Invariants enforced here:
 *  - I-07 Reflection, Not Judgment: output is run through `assertNoJudgment`. No
 *    scores, no streaks, no "good/bad", no interpretive words.
 *  - I-06 No Dependency Replacement: this is generated on demand, not a feed.
 *
 * Grouping/summary wording here is placeholder for Step 5.
 */

import type { Context, TimeFrameBoundary } from '../contracts/context.contract.ts';
import type { Pattern } from '../contracts/pattern.contract.ts';
import type { ReflectionMirror } from '../contracts/reflection.contract.ts';
import { assertNoJudgment, assertNonCoerciveText } from '../invariants/invariants.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';

export interface ReflectionSample {
  readonly pattern: Pattern;
  readonly context: Context;
}

export interface ReflectionRequest {
  readonly samples: readonly ReflectionSample[];
  readonly timeRangeStart: number;
  readonly timeRangeEnd: number;
}

function dominantTimeFrame(frames: readonly TimeFrameBoundary[]): TimeFrameBoundary | null {
  if (frames.length === 0) return null;
  const tally = new Map<TimeFrameBoundary, number>();
  for (const f of frames) tally.set(f, (tally.get(f) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

export function buildReflectionMirror(
  req: ReflectionRequest,
  ids: IdFactory,
  clock: Clock,
): ReflectionMirror {
  const inRange = req.samples.filter(
    (s) => s.context.timestamp >= req.timeRangeStart && s.context.timestamp < req.timeRangeEnd,
  );

  const byName = new Map<string, ReflectionSample[]>();
  for (const s of inRange) {
    (byName.get(s.pattern.structuralName) ?? byName.set(s.pattern.structuralName, []).get(s.pattern.structuralName)!)
      .push(s);
  }

  const observableFacts = [...byName.entries()].map(([patternName, samples]) => {
    const frames = samples.map((s) => s.context.temporal.timeFrame);
    const days = new Set(samples.map((s) => s.context.temporal.dayOfWeek)).size;
    const dom = dominantTimeFrame(frames);
    const contextSummary = dom
      ? `Most often in the ${dom} time frame, across ${days} day(s).`
      : `Across ${days} day(s).`;
    assertNonCoerciveText(contextSummary);
    return { patternName, occurrenceCount: samples.length, contextSummary };
  });

  const mirror: ReflectionMirror = {
    id: ids.uuid(),
    generatedAt: clock.now(),
    timeRangeStart: req.timeRangeStart,
    timeRangeEnd: req.timeRangeEnd,
    observableFacts,
  };

  assertNoJudgment(mirror); // I-07 hard guard
  return mirror;
}
