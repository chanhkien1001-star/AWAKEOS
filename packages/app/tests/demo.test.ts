import test from 'node:test';
import assert from 'node:assert/strict';

import { assertNoJudgment } from '@awake-os/core';
import { runDemo } from '../src/demo/run-demo.ts';

test('the demo runs end-to-end and produces a coherent narrated result', async () => {
  const lines: string[] = [];
  const result = await runDemo({ log: (l) => lines.push(l) });

  assert.ok(result.events > 60, 'tonight has a full session of signals');
  assert.ok(result.outcomes.length === result.events, 'one outcome per event');

  // it opened at least one Awareness Window, and it also fell silent (fatigue / uncertainty)
  assert.ok(result.interventions >= 1, 'expected at least one Awareness Window');
  assert.ok(result.silences >= 1, 'expected Silence to be exercised');

  // the mirror is a real, non-judgmental artefact
  assert.doesNotThrow(() => assertNoJudgment(result.mirror));
  assert.ok(result.mirror.observableFacts.length >= 1);

  // the narration actually printed a window
  assert.ok(lines.some((l) => l.includes('Awareness Window')));
  assert.ok(lines.some((l) => l.includes('Reflection Mirror')));
});
