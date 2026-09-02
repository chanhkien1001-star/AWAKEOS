import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeInterventionFatigue,
  fatigueIndexFor,
  DEFAULT_FATIGUE_CONFIG,
  type PriorInterventionSummary,
} from '../src/engines/fatigue.ts';

const NOW = 5_000_000;
const p = (ageMs: number, category: PriorInterventionSummary['category'], choice?: PriorInterventionSummary['choice']) =>
  (choice === undefined ? { triggeredAt: NOW - ageMs, category } : { triggeredAt: NOW - ageMs, category, choice });

test('no priors -> zero fatigue', () => {
  const r = computeInterventionFatigue([], NOW);
  assert.equal(r.global, 0);
  assert.equal(fatigueIndexFor(r, 'ExtendedDuration'), 0);
});

test('fatigue decays with the configured half-life', () => {
  const oneHalfLife = computeInterventionFatigue([p(DEFAULT_FATIGUE_CONFIG.halfLifeMs, 'RapidTransition')], NOW);
  const fresh = computeInterventionFatigue([p(0, 'RapidTransition')], NOW);
  assert.ok(Math.abs(oneHalfLife.global - fresh.global / 2) < 1e-9);
});

test('interventions past the window are ignored', () => {
  const r = computeInterventionFatigue([p(DEFAULT_FATIGUE_CONFIG.windowMs + 1, 'ExtendedDuration')], NOW);
  assert.equal(r.global, 0);
});

test('the same category weighs more than a mixed history of equal size', () => {
  const sameCat = computeInterventionFatigue([p(1_000, 'ExtendedDuration'), p(2_000, 'ExtendedDuration')], NOW);
  const mixed = computeInterventionFatigue([p(1_000, 'ExtendedDuration'), p(2_000, 'RapidTransition')], NOW);
  assert.ok(
    fatigueIndexFor(sameCat, 'ExtendedDuration') > fatigueIndexFor(mixed, 'ExtendedDuration'),
  );
});

test('I-01: a conscious keep-going choice raises fatigue; every multiplier is >= 1', () => {
  const base = computeInterventionFatigue([p(1_000, 'ExtendedDuration')], NOW).global;
  for (const [choice, mult] of Object.entries(DEFAULT_FATIGUE_CONFIG.choiceMultipliers)) {
    assert.ok(mult >= 1, `${choice} multiplier ${mult} must be >= 1 (choice feedback can only quiet the system)`);
    const withChoice = computeInterventionFatigue(
      [p(1_000, 'ExtendedDuration', choice as PriorInterventionSummary['choice'])],
      NOW,
    ).global;
    assert.ok(withChoice >= base - 1e-9);
  }
  const continued = computeInterventionFatigue([p(1_000, 'ExtendedDuration', 'Continue')], NOW).global;
  assert.ok(continued > base);
});

test('fatigueIndexFor blends global and per-category load', () => {
  const r = computeInterventionFatigue(
    [p(1_000, 'ExtendedDuration', 'Continue'), p(2_000, 'RapidTransition')],
    NOW,
  );
  // asking about ExtendedDuration sees its heavy per-category tally
  const ext = fatigueIndexFor(r, 'ExtendedDuration');
  // asking about TemporalDensity (none) sees only the global load
  const temp = fatigueIndexFor(r, 'TemporalDensity');
  assert.ok(ext > temp);
  assert.equal(temp, r.global);
});
