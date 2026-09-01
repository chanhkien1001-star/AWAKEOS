/**
 * "The Return" (Context Transition) — the optional moment shown when a person
 * leaves an extended session.
 *
 * Spec: dark screen, the text "You are here", one subtle haptic beat, auto-dismiss
 * after 2 seconds. NO celebratory animation, NO points, NO gamified reward
 * (I-10). It is skippable on tap (I-08).
 */

import type { ReturnMoment } from '@awake-os/core';

export const RETURN_MOMENT: ReturnMoment = Object.freeze({
  text: 'You are here',
  hapticBeats: 1,
  autoDismissMs: 2_000,
});

export interface ReturnMomentViewModel {
  readonly text: 'You are here';
  readonly backgroundColor: '#000000';
  readonly hapticBeats: 1;
  readonly autoDismissMs: 2_000;
  readonly skippableOnTap: true;
  /** Explicitly forbidden extras, listed so no one "improves" this screen later. */
  readonly noConfetti: true;
  readonly noSound: true;
  readonly noPointsOrStreak: true;
}

export function toReturnMomentViewModel(_moment: ReturnMoment = RETURN_MOMENT): ReturnMomentViewModel {
  return {
    text: 'You are here',
    backgroundColor: '#000000',
    hapticBeats: 1,
    autoDismissMs: 2_000,
    skippableOnTap: true,
    noConfetti: true,
    noSound: true,
    noPointsOrStreak: true,
  };
}
