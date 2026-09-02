import test from 'node:test';
import assert from 'node:assert/strict';

import type { AwarenessWindow, Intervention } from '@awake-os/core';
import { toAwarenessWindowViewModel } from '../src/awareness-window/awareness-window.viewmodel.ts';
import { createAwarenessWindowController } from '../src/awareness-window/awareness-window-controller.ts';

const OPENED = 1_000_000;

const intervention: Intervention = {
  id: 'i1',
  candidateId: 'c1',
  triggeredAt: OPENED,
  modality: 'VisualPauseOverlay',
  payloadText:
    'Awareness Window. Current application has been in the foreground for 30 minutes without a break. This window opened because a structural threshold was crossed. Your choice.',
};
const window: AwarenessWindow = { id: 'w1', interventionId: 'i1', openedAt: OPENED, activeDurationMs: 4_000 };

function mutableClock(start: number) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; }, set: (v: number) => { t = v; } };
}
function ids(seed = 'k') {
  let n = 0;
  return { uuid: () => `${seed}-${++n}` };
}

function make(clock = mutableClock(OPENED)) {
  const vm = toAwarenessWindowViewModel(intervention, window);
  return { clock, controller: createAwarenessWindowController({ vm, ids: ids(), clock, openedAtMs: OPENED }) };
}

test('starts in holding with choices disabled and a full hold remaining', () => {
  const { controller } = make();
  const s = controller.state();
  assert.equal(s.phase, 'holding');
  assert.equal(s.choicesEnabled, false);
  assert.equal(s.holdRemainingMs, 4_000);
  assert.equal(s.result, null);
});

test('I-05: choose() is a silent no-op during the mandatory hold', () => {
  const { clock, controller } = make();
  clock.advance(1_500);
  controller.tick();
  controller.choose('Exit');
  assert.equal(controller.state().phase, 'holding');
  assert.equal(controller.state().result, null);
});

test('after the hold elapses, choices go live together and a choice resolves', () => {
  const { clock, controller } = make();
  clock.advance(4_000);
  controller.tick();
  assert.equal(controller.state().phase, 'ready');
  assert.equal(controller.state().choicesEnabled, true);

  controller.choose('Continue', 'meant to check one thing');
  const s = controller.state();
  assert.equal(s.phase, 'resolved');
  assert.equal(s.result?.choice, 'Continue');
  assert.equal(s.result?.awarenessWindowId, 'w1');
  assert.equal(s.result?.userSovereignNote, 'meant to check one thing');
});

test('I-13: choicesEnabled is a single flag — never enabled per choice', () => {
  const { clock, controller } = make();
  // sample the flag through the hold and past it; it is one boolean for all choices
  const seen: boolean[] = [];
  controller.subscribe((s) => seen.push(s.choicesEnabled));
  clock.advance(2_000); controller.tick();
  clock.advance(2_100); controller.tick();
  assert.deepEqual([...new Set(seen)].sort(), [false, true]);
  // the view-model still carries N choices, all with identical weight
  const weights = controller.state().vm.choices.map((c) => JSON.stringify({ ...c.weight, order: 0 }));
  assert.equal(new Set(weights).size, 1);
});

test('I-08: dismiss() works during the hold and yields a first-class Dismiss choice', () => {
  const { controller } = make();
  controller.dismiss();
  const s = controller.state();
  assert.equal(s.phase, 'resolved');
  assert.equal(s.result?.choice, 'Dismiss');
});

test('resolution is idempotent — later choose()/dismiss() are ignored', () => {
  const { clock, controller } = make();
  clock.advance(4_100); controller.tick();
  controller.choose('Exit');
  controller.choose('Continue');
  controller.dismiss();
  assert.equal(controller.state().result?.choice, 'Exit');
});

test('holdRemainingMs decreases monotonically to zero', () => {
  const { clock, controller } = make();
  const readings: number[] = [controller.state().holdRemainingMs];
  for (let i = 0; i < 5; i++) {
    clock.advance(1_000);
    controller.tick();
    readings.push(controller.state().holdRemainingMs);
  }
  for (let i = 1; i < readings.length; i++) assert.ok(readings[i]! <= readings[i - 1]!);
  assert.equal(readings.at(-1), 0);
});

test('enforceHold:false makes choices live immediately', () => {
  const vm = toAwarenessWindowViewModel(intervention, window);
  const c = createAwarenessWindowController({
    vm, ids: ids(), clock: mutableClock(OPENED), openedAtMs: OPENED, config: { enforceHold: false },
  });
  assert.equal(c.state().phase, 'ready');
  c.choose('ChangeContext');
  assert.equal(c.state().result?.choice, 'ChangeContext');
});
