/**
 * View-model for the Reflection Mirror screen. Pure.
 *
 * It maps a ReflectionMirror straight to display rows and re-runs
 * `assertNoJudgment` (I-07). There is deliberately no sorting by "severity", no
 * total, no trend arrow, no colour coding — a mirror shows facts, in the order
 * they were aggregated, and stops.
 */

import type { ReflectionMirror } from '@awake-os/core';
import { assertNoJudgment } from '@awake-os/core';

export interface ReflectionRow {
  readonly patternName: string;
  readonly occurrenceCount: number;
  readonly contextSummary: string;
}

export interface ReflectionMirrorViewModel {
  readonly rangeLabel: string;
  readonly rows: readonly ReflectionRow[];
  /** Shown when there is nothing to mirror — this is a calm, complete state. */
  readonly emptyText: string;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function toReflectionMirrorViewModel(mirror: ReflectionMirror): ReflectionMirrorViewModel {
  assertNoJudgment(mirror);
  return {
    rangeLabel: `${isoDate(mirror.timeRangeStart)} — ${isoDate(mirror.timeRangeEnd)}`,
    rows: mirror.observableFacts.map((f) => ({
      patternName: f.patternName,
      occurrenceCount: f.occurrenceCount,
      contextSummary: f.contextSummary,
    })),
    emptyText: 'No structural patterns recorded in this range.',
  };
}
