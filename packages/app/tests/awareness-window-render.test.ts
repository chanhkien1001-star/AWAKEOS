import test from 'node:test';
import assert from 'node:assert/strict';

import type { AwarenessWindow, Intervention } from '@awake-os/core';
import { InvariantViolation } from '@awake-os/core';
import { toAwarenessWindowViewModel } from '../src/awareness-window/awareness-window.viewmodel.ts';
import { createAwarenessWindowController } from '../src/awareness-window/awareness-window-controller.ts';
import { describeAwarenessWindowRender } from '../src/awareness-window/awareness-window-render.ts';

const OPENED = 2_000_000;
const intervention: Intervention = {
  id: 'i1',
  candidateId: 'c1',
  triggeredAt: OPENED,
  modality: 'ContextualPrompt',
  payloadText:
    'Awareness Window. 8 application switches in the last 40 seconds. This window opened because a structural threshold was crossed. Your choice.',
};
const window: AwarenessWindow = { id: 'w1', interventionId: 'i1', openedAt: OPENED, activeDurationMs: 3_000 };

function clockAt(t: number) {
  return { now: () => t };
}
function controllerAt(t: number) {
  const vm = toAwarenessWindowViewModel(intervention, window);
  let n = 0;
  const c = createAwarenessWindowController({
    vm, ids: { uuid: () => `r-${++n}` }, clock: clockAt(t), openedAtMs: OPENED,
  });
  c.tick(t);
  return c;
}

test('every rendered choice shares ONE style object reference and no emphasis (I-13)', () => {
  const r = describeAwarenessWindowRender(controllerAt(OPENED + 5_000).state());
  assert.ok(r.choices.length >= 2);
  const style0 = r.choices[0]!.style;
  for (const c of r.choices) {
    assert.equal(c.style, style0); // identity, not just deep-equal
    assert.equal(c.emphasis, 'none');
    assert.equal(c.enabled, true);
  }
});

test('choices are all disabled together during the hold', () => {
  const r = describeAwarenessWindowRender(controllerAt(OPENED + 500).state());
  assert.equal(r.phase, 'holding');
  assert.ok(r.showsHoldIndicator);
  assert.ok(r.choices.every((c) => c.enabled === false));
  assert.ok(r.holdProgress > 0 && r.holdProgress < 1);
});

test('bodyText is passed through verbatim (I-12)', () => {
  const r = describeAwarenessWindowRender(controllerAt(OPENED + 5_000).state());
  assert.equal(r.bodyText, intervention.payloadText);
});

test('a coercive bodyText never reaches a render descriptor', () => {
  const bad: Intervention = { ...intervention, payloadText: 'Are you sure? You are wasting your evening!' };
  // the view-model rejects it first; the render layer would reject it too
  assert.throws(() => toAwarenessWindowViewModel(bad, window), InvariantViolation);
});

test('a full-screen dismiss target is always present (I-08)', () => {
  const holding = describeAwarenessWindowRender(controllerAt(OPENED + 100).state());
  const ready = describeAwarenessWindowRender(controllerAt(OPENED + 9_000).state());
  for (const r of [holding, ready]) {
    assert.equal(r.dismiss.target, 'fullscreen-background');
    assert.match(r.dismiss.hint, /dismiss/i);
  }
});

test('holdProgress reaches 1 once choices are live', () => {
  const r = describeAwarenessWindowRender(controllerAt(OPENED + 9_000).state());
  assert.equal(r.phase, 'ready');
  assert.equal(r.holdProgress, 1);
  assert.equal(r.showsHoldIndicator, false);
});
