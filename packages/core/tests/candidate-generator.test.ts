import test from 'node:test';
import assert from 'node:assert/strict';

import type { Context } from '../src/contracts/context.contract.ts';
import type { Pattern, PatternCategory } from '../src/contracts/pattern.contract.ts';
import { generateCandidate, DEFAULT_CANDIDATE_CONFIG } from '../src/engines/candidate-generator.ts';
import { fixedClock } from '../src/util/clock.ts';
import { sequentialIdFactory } from '../src/util/id.ts';

const NOW = 1_000_000;
const deps = () => ({ ids: sequentialIdFactory('cg'), clock: fixedClock(NOW) });

function pattern(over: Partial<Pattern> & { category?: PatternCategory } = {}): Pattern {
  return {
    id: 'p1',
    detectedAt: 0,
    category: over.category ?? 'ExtendedDuration',
    structuralName: 'ExtendedContinuousInteractionPattern',
    metrics: { eventDensity: 0, transitionCount: 0, totalDurationMs: 0, deviationFromBaselineRatio: 2, ...over.metrics },
    confidenceScore: over.confidenceScore ?? 0.7,
    supportingEventIds: [],
    schemaVersion: '1.0.0',
  };
}

function ctx(over: { rest?: boolean; elapsedMs?: number } = {}): Context {
  return {
    id: 'c1',
    timestamp: NOW,
    referenceEventId: 'e1',
    temporal: { timeFrame: '18:00-24:00', dayOfWeek: 3, isUserDefinedRestPeriod: over.rest ?? false },
    sequence: {
      eventsInLastWindow: 0,
      elapsedSinceLastUnlockMs: over.elapsedMs ?? 0,
      activeSubjectDurationMs: over.elapsedMs ?? 0,
    },
    schemaVersion: '1.0.0',
  };
}

test('a weak, near-baseline pattern produces no candidate', () => {
  const d = deps();
  const c = generateCandidate(
    pattern({ confidenceScore: 0.15, metrics: { deviationFromBaselineRatio: 1.05 } as Pattern['metrics'] }),
    ctx(),
    d.ids,
    d.clock,
  );
  assert.equal(c, null);
});

test('a confident, far-from-baseline pattern produces a salient candidate', () => {
  const d = deps();
  const c = generateCandidate(pattern({ confidenceScore: 0.95, metrics: { deviationFromBaselineRatio: 3 } as Pattern['metrics'] }), ctx(), d.ids, d.clock);
  assert.ok(c);
  assert.ok(c!.salienceScore > DEFAULT_CANDIDATE_CONFIG.minSalience);
  assert.equal(c!.patternId, 'p1');
  assert.equal(c!.schemaVersion, '1.0.0');
});

test('the rest-period amplifier raises salience', () => {
  const d1 = deps();
  const d2 = deps();
  const base = generateCandidate(pattern(), ctx({ rest: false }), d1.ids, d1.clock);
  const rested = generateCandidate(pattern(), ctx({ rest: true }), d2.ids, d2.clock);
  assert.ok(rested!.salienceScore > base!.salienceScore);
});

test('a longer unbroken session raises salience', () => {
  const d1 = deps();
  const d2 = deps();
  const short = generateCandidate(pattern(), ctx({ elapsedMs: 5 * 60_000 }), d1.ids, d1.clock);
  const long = generateCandidate(pattern(), ctx({ elapsedMs: 80 * 60_000 }), d2.ids, d2.clock);
  assert.ok(long!.salienceScore > short!.salienceScore);
});

test('category weight: ExtendedDuration outweighs Repetition at equal confidence/deviation', () => {
  const d1 = deps();
  const d2 = deps();
  const ext = generateCandidate(pattern({ category: 'ExtendedDuration' }), ctx(), d1.ids, d1.clock);
  const rep = generateCandidate(pattern({ category: 'Repetition' }), ctx(), d2.ids, d2.clock);
  assert.ok(ext!.salienceScore > rep!.salienceScore);
});

test('salienceScore always lands in [0, 1]', () => {
  const d = deps();
  const c = generateCandidate(
    pattern({ confidenceScore: 1, metrics: { deviationFromBaselineRatio: 50 } as Pattern['metrics'] }),
    ctx({ rest: true, elapsedMs: 10 * 60 * 60_000 }),
    d.ids,
    d.clock,
  );
  assert.ok(c!.salienceScore >= 0 && c!.salienceScore <= 1);
});
