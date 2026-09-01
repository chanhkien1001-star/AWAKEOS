import test from 'node:test';
import assert from 'node:assert/strict';

import type { Context } from '../src/contracts/context.contract.ts';
import type { Pattern } from '../src/contracts/pattern.contract.ts';
import { detectPatterns, DEFAULT_PATTERN_CONFIG } from '../src/engines/pattern-detector.ts';
import { emptyBaseline } from '../src/engines/baseline.ts';
import { fixedClock } from '../src/util/clock.ts';
import { sequentialIdFactory } from '../src/util/id.ts';
import { app, matureBaseline, screen, resetEventIds } from './helpers.ts';

const NOW = Date.UTC(2026, 5, 1, 20, 0, 0); // evening
const deps = () => ({ ids: sequentialIdFactory('p'), clock: fixedClock(NOW) });

function ctx(over: {
  activeSubjectDurationMs?: number;
  eventsInLastWindow?: number;
  isUserDefinedRestPeriod?: boolean;
}): Context {
  return {
    id: 'c1',
    timestamp: NOW,
    referenceEventId: 'ev-1',
    temporal: { timeFrame: '18:00-24:00', dayOfWeek: 3, isUserDefinedRestPeriod: over.isUserDefinedRestPeriod ?? false },
    sequence: {
      eventsInLastWindow: over.eventsInLastWindow ?? 0,
      elapsedSinceLastUnlockMs: over.activeSubjectDurationMs ?? 0,
      activeSubjectDurationMs: over.activeSubjectDurationMs ?? 0,
    },
    schemaVersion: '1.0.0',
  };
}

const find = (ps: readonly Pattern[], name: string): Pattern | undefined =>
  ps.find((p) => p.structuralName === name);

test('ExtendedDuration: same 30-min session IS unusual for a light-baseline person', () => {
  const d = deps();
  const baseline = matureBaseline({ now: NOW, timeFrame: '18:00-24:00', sessionMinutes: 8 });
  const patterns = detectPatterns([], ctx({ activeSubjectDurationMs: 30 * 60_000 }), baseline, d.ids, d.clock);
  const p = find(patterns, 'ExtendedContinuousInteractionPattern');
  assert.ok(p, 'expected an ExtendedContinuousInteractionPattern');
  assert.ok(p!.confidenceScore > 0.5, `confidence ${p!.confidenceScore}`);
  // deviationFromBaselineRatio ~ observed / baseline median
  const median = baseline.byTimeFrame['18:00-24:00'].sessionDurationMs.median;
  assert.ok(Math.abs(p!.metrics.deviationFromBaselineRatio - (30 * 60_000) / median) < 0.05);
});

test('ExtendedDuration: the SAME 30-min session is NOT unusual for a heavy-baseline person', () => {
  const d = deps();
  const baseline = matureBaseline({ now: NOW, timeFrame: '18:00-24:00', sessionMinutes: 45 });
  const patterns = detectPatterns([], ctx({ activeSubjectDurationMs: 30 * 60_000 }), baseline, d.ids, d.clock);
  assert.equal(find(patterns, 'ExtendedContinuousInteractionPattern'), undefined);
});

test('ExtendedDuration: an immature baseline falls back to cold-start and caps confidence', () => {
  const d = deps();
  const thin = matureBaseline({ now: NOW, timeFrame: '18:00-24:00', sessionMinutes: 8, observations: 3 });
  const patterns = detectPatterns([], ctx({ activeSubjectDurationMs: 30 * 60_000 }), thin, d.ids, d.clock);
  const p = find(patterns, 'ExtendedContinuousInteractionPattern');
  assert.ok(p, 'cold-start still flags a session well past the fallback threshold');
  assert.ok(p!.confidenceScore <= DEFAULT_PATTERN_CONFIG.coldStartConfidenceCap + 1e-9);
});

test('ExtendedDuration: below the cold-start threshold with no baseline, nothing is emitted', () => {
  const d = deps();
  const patterns = detectPatterns([], ctx({ activeSubjectDurationMs: 20 * 60_000 }), emptyBaseline(NOW), d.ids, d.clock);
  assert.equal(find(patterns, 'ExtendedContinuousInteractionPattern'), undefined);
});

test('ExtendedDuration: below the absolute floor, nothing is emitted even for the lightest baseline', () => {
  const d = deps();
  const featherweight = matureBaseline({ now: NOW, timeFrame: '18:00-24:00', sessionMinutes: 1 });
  const patterns = detectPatterns([], ctx({ activeSubjectDurationMs: 8 * 60_000 }), featherweight, d.ids, d.clock);
  assert.equal(find(patterns, 'ExtendedContinuousInteractionPattern'), undefined); // 8 min < 10 min floor
});

test('RapidTransition: baseline decides whether a switch rate is unusual', () => {
  resetEventIds();
  const start = NOW - 40_000;
  const events = [
    screen('Unlocked', start),
    ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((h, i) => app('Foreground', `hash:${h}`, start + 1 + i * 5_000)),
  ];
  const context = { ...ctx({}), timestamp: start + 1 + 7 * 5_000 };

  const dLight = deps();
  const light = matureBaseline({ now: NOW, timeFrame: '18:00-24:00', appTransitionsPerMinute: 0.5 });
  assert.ok(find(detectPatterns(events, context, light, dLight.ids, dLight.clock), 'RapidRepeatedTransition'));

  const dHeavy = deps();
  const heavy = matureBaseline({ now: NOW, timeFrame: '18:00-24:00', appTransitionsPerMinute: 20 });
  assert.equal(
    find(detectPatterns(events, context, heavy, dHeavy.ids, dHeavy.clock), 'RapidRepeatedTransition'),
    undefined,
  );
});

test('TemporalDensity: compares events-per-minute against the personal baseline', () => {
  const d = deps();
  const light = matureBaseline({ now: NOW, timeFrame: '18:00-24:00', eventsPerMinute: 4 });
  const patterns = detectPatterns([], ctx({ eventsInLastWindow: 40 }), light, d.ids, d.clock);
  const p = find(patterns, 'HighTemporalEventDensity');
  assert.ok(p);
  assert.ok(Math.abs(p!.metrics.deviationFromBaselineRatio - 40 / light.byTimeFrame['18:00-24:00'].eventsPerMinute.median) < 0.5);
});

test('a completely idle observation yields no patterns', () => {
  const d = deps();
  assert.equal(detectPatterns([], ctx({}), emptyBaseline(NOW), d.ids, d.clock).length, 0);
});
