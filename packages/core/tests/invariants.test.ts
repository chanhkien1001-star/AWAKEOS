import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INVARIANTS,
  InvariantViolation,
  assertStructuralName,
  assertNonCoerciveText,
  assertNoJudgment,
  assertChoiceSymmetry,
  assertReversible,
  type ChoiceWeight,
} from '../src/invariants/invariants.ts';

test('all 13 invariants are present and frozen', () => {
  assert.equal(INVARIANTS.length, 13);
  assert.equal(INVARIANTS[0]?.id, 'I-01');
  assert.equal(INVARIANTS[12]?.id, 'I-13');
  assert.throws(() => {
    // @ts-expect-error - runtime immutability check
    INVARIANTS.push({ id: 'I-14', title: 'x', statement: 'y' });
  });
});

test('I-11 assertStructuralName accepts structural identifiers', () => {
  assert.doesNotThrow(() => assertStructuralName('RapidRepeatedTransition'));
  assert.doesNotThrow(() => assertStructuralName('ExtendedContinuousInteractionPattern'));
});

test('I-11 assertStructuralName rejects interpretive / malformed names', () => {
  for (const bad of ['DoomscrollingPattern', 'AddictionLoop', 'CompulsiveCheck', 'Rapid Repeated', 'anxietySpike']) {
    assert.throws(() => assertStructuralName(bad), InvariantViolation, `expected reject: ${bad}`);
  }
});

test('I-12 assertNonCoerciveText rejects pressure, verdicts, and rewards', () => {
  assert.doesNotThrow(() =>
    assertNonCoerciveText('Awareness Window. 30 minutes active on current application. Your choice.'),
  );
  for (const bad of [
    'Are you sure you want to leave?',
    'You are doomscrolling!',
    'Keep going, you earned it',
    'Congratulations on your streak',
  ]) {
    assert.throws(() => assertNonCoerciveText(bad), InvariantViolation, `expected reject: ${bad}`);
  }
});

test('I-07 assertNoJudgment rejects score-shaped keys and interpretive strings', () => {
  assert.doesNotThrow(() =>
    assertNoJudgment({ observableFacts: [{ patternName: 'X', occurrenceCount: 3, contextSummary: 'Evenings.' }] }),
  );
  assert.throws(() => assertNoJudgment({ healthScore: 42 }), InvariantViolation);
  assert.throws(() => assertNoJudgment({ observableFacts: [{ contextSummary: 'addicted behaviour' }] }), InvariantViolation);
});

test('I-13 assertChoiceSymmetry requires identical visual weight and no auto-focus', () => {
  const base: ChoiceWeight = {
    fontSizePx: 16, widthPx: 140, heightPx: 48, backgroundOpacity: 0.1, animationMs: 120, autoFocused: false, order: 0,
  };
  assert.doesNotThrow(() => assertChoiceSymmetry([base, { ...base, order: 1 }]));
  assert.throws(() => assertChoiceSymmetry([base, { ...base, widthPx: 200, order: 1 }]), InvariantViolation);
  assert.throws(() => assertChoiceSymmetry([base, { ...base, autoFocused: true, order: 1 }]), InvariantViolation);
});

test('I-08 assertReversible requires dismissible, non-blocking interventions', () => {
  assert.doesNotThrow(() => assertReversible({ dismissible: true, blocksInput: false }));
  assert.throws(() => assertReversible({ dismissible: false, blocksInput: false }), InvariantViolation);
  assert.throws(() => assertReversible({ dismissible: true, blocksInput: true }), InvariantViolation);
});
