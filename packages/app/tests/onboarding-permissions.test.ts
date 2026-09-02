import test from 'node:test';
import assert from 'node:assert/strict';

import { assertNonCoerciveText } from '@awake-os/core';
import { ONBOARDING_STEPS } from '../src/onboarding/onboarding-content.ts';
import { describeUsageAccessRequest, usageAccessStatusLine, hasFullUsageAccess } from '../src/permissions/usage-access.ts';

test('onboarding has an ordered set of steps, all non-coercive (I-12)', () => {
  assert.ok(ONBOARDING_STEPS.length >= 4);
  const ids = ONBOARDING_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length); // unique
  for (const step of ONBOARDING_STEPS) {
    assert.doesNotThrow(() => assertNonCoerciveText(step.title));
    assert.doesNotThrow(() => assertNonCoerciveText(step.body));
  }
});

test('onboarding states plainly that the app is not a blocker and makes no judgment', () => {
  const all = ONBOARDING_STEPS.map((s) => `${s.title} ${s.body}`).join(' ').toLowerCase();
  assert.ok(all.includes('does not block'));
  assert.ok(all.includes('no judgment') || all.includes('makes no judgment'));
  assert.ok(all.includes('on this device'));
});

test('the Usage Access ask is optional, reversible, and non-coercive (I-08 / I-12)', () => {
  const copy = describeUsageAccessRequest();
  for (const line of [copy.title, copy.body, copy.grantLabel, copy.skipLabel, copy.afterReturn]) {
    assert.doesNotThrow(() => assertNonCoerciveText(line));
  }
  assert.match(copy.title, /optional/i);
  assert.match(copy.body, /without it/i);
  assert.match(copy.afterReturn, /any time/i);
  assert.ok(copy.skipLabel.length > 0); // there is always a way to decline
});

test('usage access status lines are neutral and cover every state', () => {
  for (const state of ['granted', 'partial', 'denied', 'restricted', 'unknown'] as const) {
    const line = usageAccessStatusLine(state);
    assert.ok(line.length > 0);
    assert.doesNotThrow(() => assertNonCoerciveText(line));
  }
  assert.equal(hasFullUsageAccess('granted'), true);
  assert.equal(hasFullUsageAccess('partial'), false);
});
