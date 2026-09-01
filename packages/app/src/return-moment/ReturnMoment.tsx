/**
 * STUB — Step 4 wires this to React Native.
 *
 * Rendering rules:
 *  - Full-bleed black (`vm.backgroundColor`), centred text `vm.text`.
 *  - Fire ONE haptic beat on mount (`vm.hapticBeats === 1`).
 *  - Auto-dismiss after `vm.autoDismissMs` (2s). Tap dismisses early (I-08).
 *  - Forbidden: confetti, sound, points, streak, "session summary". The three
 *    `no*` flags on the view-model are there to make that explicit in review.
 */

import type { ReturnMomentViewModel } from './return-moment.ts';

export interface ReturnMomentProps {
  readonly vm: ReturnMomentViewModel;
  readonly onDismiss: () => void;
}

export function ReturnMoment(_props: ReturnMomentProps): unknown {
  throw new Error('ReturnMoment: React Native implementation lands in Step 4. Use toReturnMomentViewModel.');
}
