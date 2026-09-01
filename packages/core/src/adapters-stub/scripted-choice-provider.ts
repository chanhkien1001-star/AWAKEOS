/**
 * ChoiceProvider stub — returns pre-scripted human choices instead of rendering a
 * real Awareness Window. The real implementation lives in packages/app and MUST
 * enforce I-13 (Choice Symmetry) and I-08 (Reversibility).
 *
 * `Dismiss` is the default when the script runs out: walking away without
 * choosing is itself a valid, complete outcome (I-01, I-04).
 */

import type { HumanChoice, ChoiceType } from '../contracts/human-choice.contract.ts';
import type { ChoiceProvider } from '../pipeline/ports.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';

export interface ScriptedChoice {
  readonly choice: ChoiceType;
  readonly userSovereignNote?: string;
}

export function createScriptedChoiceProvider(
  script: readonly ScriptedChoice[],
  ids: IdFactory,
  clock: Clock,
): ChoiceProvider & { calls(): number } {
  let i = 0;
  return {
    async present(window) {
      const scripted = script[i] ?? { choice: 'Dismiss' as const };
      i += 1;
      const base = {
        id: ids.uuid(),
        awarenessWindowId: window.id,
        selectedAt: clock.now(),
        choice: scripted.choice,
      };
      const result: HumanChoice =
        scripted.userSovereignNote === undefined
          ? base
          : { ...base, userSovereignNote: scripted.userSovereignNote };
      return result;
    },
    calls() {
      return i;
    },
  };
}
