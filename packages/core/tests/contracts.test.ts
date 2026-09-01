import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_SCHEMA_VERSION } from '../src/contracts/event.contract.ts';
import { CONTEXT_SCHEMA_VERSION } from '../src/contracts/context.contract.ts';
import { PATTERN_SCHEMA_VERSION } from '../src/contracts/pattern.contract.ts';
import { INTERVENTION_CANDIDATE_SCHEMA_VERSION } from '../src/contracts/intervention-candidate.contract.ts';
import { INTERVENTION_POLICY_SCHEMA_VERSION } from '../src/contracts/intervention-policy.contract.ts';
import { INTERVENTION_SCHEMA_VERSION } from '../src/contracts/intervention.contract.ts';
import { HUMAN_CHOICE_SCHEMA_VERSION } from '../src/contracts/human-choice.contract.ts';
import { REFLECTION_SCHEMA_VERSION } from '../src/contracts/reflection.contract.ts';

test('all 8 contracts declare schemaVersion 1.0.0', () => {
  for (const v of [
    EVENT_SCHEMA_VERSION,
    CONTEXT_SCHEMA_VERSION,
    PATTERN_SCHEMA_VERSION,
    INTERVENTION_CANDIDATE_SCHEMA_VERSION,
    INTERVENTION_POLICY_SCHEMA_VERSION,
    INTERVENTION_SCHEMA_VERSION,
    HUMAN_CHOICE_SCHEMA_VERSION,
    REFLECTION_SCHEMA_VERSION,
  ]) {
    assert.equal(v, '1.0.0');
  }
});

test('helpers produce Events that satisfy the frozen Event shape', async () => {
  const { screen, app, input, resetEventIds } = await import('./helpers.ts');
  resetEventIds();
  const e1 = screen('Unlocked', 1000);
  const e2 = app('Foreground', 'hash:abc', 2000);
  const e3 = input('scroll', 3000, true);

  for (const e of [e1, e2, e3]) {
    assert.equal(typeof e.id, 'string');
    assert.equal(typeof e.occurredAt, 'number');
    assert.ok(['System', 'User'].includes(e.source.type));
    assert.equal(e.schemaVersion, '1.0.0');
  }
  assert.equal(e2.type, 'ApplicationStateChanged');
  assert.deepEqual(e2.payload, { state: 'Foreground', packageNameHash: 'hash:abc' });
  assert.deepEqual(e3.payload, { actionId: 'scroll', value: true });
});
