/**
 * STUB — Step 4 wires this to React Native.
 *
 * Rendering rules this component MUST honour (enforced by review + the
 * choice-symmetry.ts guard it consumes):
 *  - I-13 Choice Symmetry: every button uses `control.weight` verbatim. No
 *    `Pressable` gets a different style, colour, or `autoFocus`. Iterate
 *    `vm.choices` in order; do not special-case index 0.
 *  - I-12 Non-Coercive Transparency: render `vm.bodyText` as-is. Do not prepend
 *    "Hey!", do not add an emoji, do not add a question.
 *  - I-08 Reversibility: tapping the dimmed background emits `Dismiss` and closes.
 *  - I-05: the overlay fades in over `SYMMETRIC_CHOICE_WEIGHT.animationMs`; the
 *    window auto-relaxes (buttons enabled) after `vm.holdMs`.
 *
 * @example
 *   const vm = toAwarenessWindowViewModel(intervention, awarenessWindow);
 *   <AwarenessWindow vm={vm} onChoice={(choice) => resolve({ choice })} />
 */

import type { ChoiceType } from '@awake-os/core';
import type { AwarenessWindowViewModel } from './awareness-window.viewmodel.ts';

export interface AwarenessWindowProps {
  readonly vm: AwarenessWindowViewModel;
  readonly onChoice: (choice: ChoiceType, note?: string) => void;
}

export function AwarenessWindow(_props: AwarenessWindowProps): unknown {
  throw new Error('AwarenessWindow: React Native implementation lands in Step 4. Use the view-model + choice-symmetry guard.');
}
