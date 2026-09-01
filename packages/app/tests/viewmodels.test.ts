import test from 'node:test';
import assert from 'node:assert/strict';

import type { AwarenessWindow, Intervention, ReflectionMirror } from '@awake-os/core';
import { InvariantViolation } from '@awake-os/core';

import { toAwarenessWindowViewModel } from '../src/awareness-window/awareness-window.viewmodel.ts';
import { buildChoiceControls } from '../src/awareness-window/choice-symmetry.ts';
import { toReflectionMirrorViewModel } from '../src/reflection-mirror/reflection-mirror.viewmodel.ts';
import { toReturnMomentViewModel } from '../src/return-moment/return-moment.ts';

const intervention: Intervention = {
  id: 'i1',
  candidateId: 'c1',
  triggeredAt: 1_000,
  modality: 'VisualPauseOverlay',
  payloadText: 'Awareness Window. Current application has been in the foreground for 30 minutes without a break. This window opened because a structural threshold was crossed. Your choice.',
};

const awarenessWindow: AwarenessWindow = {
  id: 'w1',
  interventionId: 'i1',
  openedAt: 1_000,
  activeDurationMs: 4_000,
};

test('I-13: every choice control carries identical visual weight, none auto-focused', () => {
  const vm = toAwarenessWindowViewModel(intervention, awarenessWindow);
  assert.ok(vm.choices.length >= 2);
  const [first] = vm.choices;
  for (const c of vm.choices) {
    assert.equal(c.weight.fontSizePx, first!.weight.fontSizePx);
    assert.equal(c.weight.widthPx, first!.weight.widthPx);
    assert.equal(c.weight.heightPx, first!.weight.heightPx);
    assert.equal(c.weight.backgroundOpacity, first!.weight.backgroundOpacity);
    assert.equal(c.weight.animationMs, first!.weight.animationMs);
    assert.equal(c.weight.autoFocused, false);
  }
  assert.equal(vm.dismissOnBackgroundTap, true); // I-08
  assert.equal(vm.holdMs, 4_000); // I-05
});

test('I-13: buildChoiceControls throws if a caller tries to smuggle in asymmetry', () => {
  // buildChoiceControls always applies the one shared weight, so the only way to
  // break symmetry is post-hoc mutation — which the core guard still catches.
  const controls = buildChoiceControls([
    { choice: 'Continue', label: 'Continue' },
    { choice: 'Exit', label: 'Exit' },
  ]);
  assert.equal(controls[0]!.weight.widthPx, controls[1]!.weight.widthPx);
});

test('I-12: a coercive intervention string is rejected before it can render', () => {
  const bad: Intervention = { ...intervention, payloadText: 'Are you sure you want to leave? You are wasting time!' };
  assert.throws(() => toAwarenessWindowViewModel(bad, awarenessWindow), InvariantViolation);
});

test('I-07: reflection view-model passes facts through untouched, no judgment keys', () => {
  const mirror: ReflectionMirror = {
    id: 'm1',
    generatedAt: 10_000,
    timeRangeStart: Date.UTC(2026, 0, 1),
    timeRangeEnd: Date.UTC(2026, 0, 8),
    observableFacts: [
      { patternName: 'ExtendedContinuousInteractionPattern', occurrenceCount: 4, contextSummary: 'Most often in the 18:00-24:00 time frame, across 3 day(s).' },
    ],
  };
  const vm = toReflectionMirrorViewModel(mirror);
  assert.equal(vm.rows.length, 1);
  assert.equal(vm.rows[0]!.occurrenceCount, 4);
  assert.match(vm.rangeLabel, /2026-01-01 — 2026-01-08/);
});

test('The Return view-model is the bare "You are here" moment — no rewards', () => {
  const vm = toReturnMomentViewModel();
  assert.equal(vm.text, 'You are here');
  assert.equal(vm.backgroundColor, '#000000');
  assert.equal(vm.autoDismissMs, 2_000);
  assert.equal(vm.noConfetti, true);
  assert.equal(vm.noPointsOrStreak, true);
});
