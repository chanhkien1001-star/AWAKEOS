/**
 * Render descriptor for the Reflection Mirror screen. Pure.
 *
 * `describeReflectionMirrorRender` turns the view-model into a flat object the
 * `.tsx` renders one-to-one. The invariants are asserted here:
 *
 *  - I-07  every row carries the SAME frozen `ROW_STYLE` reference and
 *          `emphasis: 'none'`; row order is preserved from the mirror (already
 *          neutral, by time-of-day frame) and is NOT re-sorted by count.
 *          The whole descriptor is re-checked with `assertNoJudgment`.
 *  - no totals, no averages, no trend arrows, no colours keyed to magnitude.
 */

import { assertNoJudgment } from '@awake-os/core';
import type { ReflectionMirrorViewModel } from './reflection-mirror.viewmodel.ts';

export interface ReflectionRowStyle {
  readonly paddingPx: number;
  readonly fontSizePx: number;
  readonly countFontSizePx: number;
}

/** One style object shared by every row. Never derive a per-row variant. */
export const ROW_STYLE: ReflectionRowStyle = Object.freeze({
  paddingPx: 14,
  fontSizePx: 15,
  countFontSizePx: 15,
});

export interface RenderedReflectionRow {
  readonly patternName: string;
  /** The plain count, rendered as text — not a bar, not a badge. */
  readonly occurrenceText: string;
  readonly contextSummary: string;
  readonly style: ReflectionRowStyle;
  readonly emphasis: 'none';
}

export interface ReflectionMirrorRender {
  readonly rangeLabel: string;
  readonly isEmpty: boolean;
  readonly emptyText: string;
  readonly rows: readonly RenderedReflectionRow[];
}

export function describeReflectionMirrorRender(vm: ReflectionMirrorViewModel): ReflectionMirrorRender {
  assertNoJudgment(vm); // I-07, at the last point before pixels

  const rows: RenderedReflectionRow[] = vm.rows.map((r) => ({
    patternName: r.patternName,
    occurrenceText: `${r.occurrenceCount} time${r.occurrenceCount === 1 ? '' : 's'}`,
    contextSummary: r.contextSummary,
    style: ROW_STYLE,
    emphasis: 'none',
  }));

  return {
    rangeLabel: vm.rangeLabel,
    isEmpty: rows.length === 0,
    emptyText: vm.emptyText,
    rows,
  };
}
