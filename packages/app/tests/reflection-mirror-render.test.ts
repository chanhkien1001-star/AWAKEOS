import test from 'node:test';
import assert from 'node:assert/strict';

import type { ReflectionMirror } from '@awake-os/core';
import { toReflectionMirrorViewModel } from '../src/reflection-mirror/reflection-mirror.viewmodel.ts';
import { describeReflectionMirrorRender } from '../src/reflection-mirror/reflection-mirror-render.ts';
import { reflectionRange, REFLECTION_RANGE_PRESETS } from '../src/reflection-mirror/reflection-range.ts';

const NOW = Date.UTC(2026, 4, 13, 15, 0, 0); // Wed

function mirror(facts: ReflectionMirror['observableFacts']): ReflectionMirror {
  return { id: 'm1', generatedAt: NOW, timeRangeStart: NOW - 7 * 24 * 60 * 60_000, timeRangeEnd: NOW, observableFacts: facts };
}

test('every row shares one style object and no emphasis (I-07)', () => {
  const r = describeReflectionMirrorRender(
    toReflectionMirrorViewModel(
      mirror([
        { patternName: 'HighTemporalEventDensity', occurrenceCount: 1, contextSummary: 'Recorded most often in the 06:00-12:00 time frame, on 1 day.' },
        { patternName: 'ExtendedContinuousInteractionPattern', occurrenceCount: 9, contextSummary: 'Recorded most often in the 18:00-24:00 time frame, on 5 days.' },
      ]),
    ),
  );
  assert.equal(r.rows.length, 2);
  const s0 = r.rows[0]!.style;
  for (const row of r.rows) {
    assert.equal(row.style, s0); // identity
    assert.equal(row.emphasis, 'none');
  }
});

test('row order is preserved from the mirror — never re-sorted by count', () => {
  const r = describeReflectionMirrorRender(
    toReflectionMirrorViewModel(
      mirror([
        { patternName: 'A', occurrenceCount: 2, contextSummary: 'x' },
        { patternName: 'B', occurrenceCount: 9, contextSummary: 'y' },
        { patternName: 'C', occurrenceCount: 1, contextSummary: 'z' },
      ]),
    ),
  );
  assert.deepEqual(r.rows.map((row) => row.patternName), ['A', 'B', 'C']);
});

test('count is rendered as plain text, singular/plural aware', () => {
  const r = describeReflectionMirrorRender(
    toReflectionMirrorViewModel(
      mirror([
        { patternName: 'A', occurrenceCount: 1, contextSummary: 'x' },
        { patternName: 'B', occurrenceCount: 4, contextSummary: 'y' },
      ]),
    ),
  );
  assert.equal(r.rows[0]!.occurrenceText, '1 time');
  assert.equal(r.rows[1]!.occurrenceText, '4 times');
});

test('an empty mirror renders the calm empty state', () => {
  const r = describeReflectionMirrorRender(toReflectionMirrorViewModel(mirror([])));
  assert.equal(r.isEmpty, true);
  assert.ok(r.emptyText.length > 0);
});

test('range presets produce sane windows ending now', () => {
  for (const p of REFLECTION_RANGE_PRESETS) {
    const range = reflectionRange(NOW, p);
    assert.equal(range.endMs, NOW);
    assert.ok(range.startMs <= NOW);
    assert.ok(range.label.length > 0);
  }
  assert.equal(reflectionRange(NOW, 'last-7-days').startMs, NOW - 7 * 24 * 60 * 60_000);
  // Wednesday -> this-week starts Monday 00:00 UTC
  assert.equal(reflectionRange(NOW, 'this-week').startMs, Date.UTC(2026, 4, 11));
});
