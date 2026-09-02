import test from 'node:test';
import assert from 'node:assert/strict';

import type { AwarenessWindow, Intervention, UsageSession } from '@awake-os/core';
import {
  computeBaseline,
  createMemoryStore,
  createPipeline,
  createScriptedEventSource,
} from '@awake-os/core';
import {
  awaitResolution,
  createAwarenessWindowChoiceProvider,
  type AwarenessWindowPresenter,
} from '../src/awareness-window/choice-provider-adapter.ts';
import { describeAwarenessWindowRender } from '../src/awareness-window/awareness-window-render.ts';
import { screen, app, input } from './helpers.ts';

const OPENED = 3_000_000;
const intervention: Intervention = {
  id: 'i1',
  candidateId: 'c1',
  triggeredAt: OPENED,
  modality: 'VisualPauseOverlay',
  payloadText:
    'Awareness Window. Current application has been in the foreground for 45 minutes without a break. This window opened because a structural threshold was crossed. Your choice.',
};
const window: AwarenessWindow = { id: 'w1', interventionId: 'i1', openedAt: OPENED, activeDurationMs: 4_000 };

function ids(seed = 'a') {
  let n = 0;
  return { uuid: () => `${seed}-${++n}` };
}
function mutableClock(start: number) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

/** Presenter that waits out the hold, drives a render pass, then acts. */
function scriptedPresenter(clock: ReturnType<typeof mutableClock>, act: 'Exit' | 'Continue' | 'dismiss'): AwarenessWindowPresenter {
  return {
    present(controller) {
      clock.advance(5_000);
      controller.tick();
      const render = describeAwarenessWindowRender(controller.state());
      assert.equal(render.phase, 'ready'); // hold really was enforced
      if (act === 'dismiss') controller.dismiss();
      else controller.choose(act);
      return awaitResolution(controller);
    },
  };
}

test('the adapter satisfies ChoiceProvider and returns the scripted HumanChoice', async () => {
  const clock = mutableClock(OPENED);
  const provider = createAwarenessWindowChoiceProvider({ ids: ids(), clock, presenter: scriptedPresenter(clock, 'Exit') });
  const choice = await provider.present(window, intervention);
  assert.equal(choice.choice, 'Exit');
  assert.equal(choice.awarenessWindowId, 'w1');
});

test('a dismiss from the background maps to a Dismiss choice', async () => {
  const clock = mutableClock(OPENED);
  const provider = createAwarenessWindowChoiceProvider({ ids: ids(), clock, presenter: scriptedPresenter(clock, 'dismiss') });
  const choice = await provider.present(window, intervention);
  assert.equal(choice.choice, 'Dismiss');
});

/** A mature evening baseline of ~15-min sessions, built through the real reducer. */
function eveningBaseline(now: number) {
  const day = 24 * 60 * 60_000;
  const sessions: UsageSession[] = Array.from({ length: 20 }, (_, k) => {
    const started = new Date(now - (k + 1) * day);
    started.setUTCHours(21, 0, 0, 0);
    const startedAt = started.getTime();
    const durationMs = (14 + (k % 5)) * 60_000;
    return {
      startedAt,
      endedAt: startedAt + durationMs,
      durationMs,
      timeFrame: '18:00-24:00',
      dayOfWeek: 3,
      appTransitionCount: 2,
      eventCount: 30,
      maxRepeatedInputRun: 3,
      openEnded: false,
    };
  });
  return computeBaseline(sessions, { now, coverageDays: 40 });
}

test('E2E: the pipeline drives the real Awareness Window controller through to a choice', async () => {
  const startAt = Date.UTC(2026, 0, 6, 21, 0, 0);
  const durationMs = 45 * 60_000;
  const events = [screen('Unlocked', startAt), app('Foreground', 'sha256:app', startAt + 1_000)];
  for (let i = 1; i <= 30; i++) events.push(input(`k${i % 7}`, startAt + 1_000 + i * (durationMs / 30)));
  const lastAt = events[events.length - 1]!.occurredAt;

  const clock = mutableClock(lastAt + 1_000);
  const store = createMemoryStore();

  const pipeline = createPipeline({
    eventSource: createScriptedEventSource(events),
    choiceProvider: createAwarenessWindowChoiceProvider({
      ids: ids('cp'),
      clock,
      presenter: {
        present(controller) {
          controller.tick(clock.now() + 6_000);
          controller.choose('Exit');
          return awaitResolution(controller);
        },
      },
    }),
    store,
    ids: ids('pl'),
    clock,
    getBaseline: () => eveningBaseline(clock.now()),
  });

  const outcomes = await pipeline.tick();
  const choiceOutcome = outcomes.find((o) => o.kind === 'Choice');
  assert.ok(choiceOutcome, 'expected the pipeline to reach a human choice via the UI controller');
  if (choiceOutcome && choiceOutcome.kind === 'Choice') {
    assert.equal(choiceOutcome.choice.choice, 'Exit');
    assert.match(choiceOutcome.intervention.payloadText, /^Awareness Window\./);
  }
});
