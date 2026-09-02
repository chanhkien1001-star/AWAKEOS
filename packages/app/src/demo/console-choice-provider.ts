/**
 * A headless `ChoiceProvider` for the demo and for CI smoke tests.
 *
 * It runs the REAL Awareness Window controller (so the mandatory hold, choice
 * symmetry and dismiss behaviour are all exercised), prints the window through
 * the render descriptor, then answers from a script (looping, default `Dismiss`).
 */

import type { ChoiceProvider, ChoiceType, Clock, IdFactory } from '@awake-os/core';
import {
  awaitResolution,
  createAwarenessWindowChoiceProvider,
} from '../awareness-window/choice-provider-adapter.ts';
import { describeAwarenessWindowRender } from '../awareness-window/awareness-window-render.ts';

export function createConsoleChoiceProvider(deps: {
  readonly ids: IdFactory;
  readonly clock: Clock & { advance?: (ms: number) => void };
  readonly script: readonly ChoiceType[];
  readonly log: (line: string) => void;
}): ChoiceProvider {
  let i = 0;
  return createAwarenessWindowChoiceProvider({
    ids: deps.ids,
    clock: deps.clock,
    presenter: {
      present(controller) {
        // wait out the mandatory hold
        controller.tick((deps.clock.now?.() ?? 0) + 6_000);
        const render = describeAwarenessWindowRender(controller.state());
        deps.log(`\n  ┌─ ${render.bodyText}`);
        deps.log(`  │  choices: ${render.choices.map((c) => `[${c.label}]`).join(' ')}  (all equal weight)`);
        const choice = deps.script[i % deps.script.length] ?? 'Dismiss';
        i += 1;
        controller.choose(choice);
        deps.log(`  └─ → ${choice}`);
        return awaitResolution(controller);
      },
    },
  });
}
