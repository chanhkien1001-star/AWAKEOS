/**
 * STAGE 7 — render descriptor.
 *
 * `describeAwarenessWindowRender` turns controller state into a plain object that
 * says exactly what the screen shows. The `.tsx` translates this to React Native
 * elements one-to-one; the invariants are asserted here, not trusted to the
 * component:
 *
 *  - I-13  every choice carries the SAME frozen style object (by reference) and
 *          `emphasis: 'none'`. There is no primary/secondary, no default focus.
 *  - I-12  `bodyText` is re-checked with `assertNonCoerciveText` and rendered
 *          verbatim — the component may not prepend, append or decorate it.
 *  - I-08  a full-screen dismiss target is always present.
 */

import type { ChoiceType } from '@awake-os/core';
import { assertChoiceSymmetry, assertNonCoerciveText } from '@awake-os/core';
import { SYMMETRIC_CHOICE_WEIGHT } from './choice-symmetry.ts';
import type { AwarenessWindowPhase, AwarenessWindowState } from './awareness-window-controller.ts';

export interface ChoiceRenderStyle {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly fontSizePx: number;
  readonly backgroundOpacity: number;
  readonly pressAnimationMs: number;
  readonly borderRadiusPx: number;
}

/** The one style object shared by every choice control. Never derive a per-choice variant. */
export const CHOICE_RENDER_STYLE: ChoiceRenderStyle = Object.freeze({
  widthPx: SYMMETRIC_CHOICE_WEIGHT.widthPx,
  heightPx: SYMMETRIC_CHOICE_WEIGHT.heightPx,
  fontSizePx: SYMMETRIC_CHOICE_WEIGHT.fontSizePx,
  backgroundOpacity: SYMMETRIC_CHOICE_WEIGHT.backgroundOpacity,
  pressAnimationMs: SYMMETRIC_CHOICE_WEIGHT.animationMs,
  borderRadiusPx: 14,
});

export interface RenderedChoice {
  readonly choice: ChoiceType;
  readonly label: string;
  readonly enabled: boolean;
  readonly style: ChoiceRenderStyle;
  readonly emphasis: 'none';
}

export interface AwarenessWindowRender {
  readonly phase: AwarenessWindowPhase;
  readonly bodyText: string;
  readonly holdRemainingMs: number;
  /** 0 -> 1 across the mandatory hold; 1 once choices are live. */
  readonly holdProgress: number;
  readonly showsHoldIndicator: boolean;
  readonly choices: readonly RenderedChoice[];
  readonly dismiss: { readonly target: 'fullscreen-background'; readonly hint: string };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const DISMISS_HINT = 'Tap outside this panel to dismiss it.';

export function describeAwarenessWindowRender(state: AwarenessWindowState): AwarenessWindowRender {
  // Re-assert the invariants at the last point before pixels.
  assertNonCoerciveText(state.vm.bodyText); // I-12
  assertNonCoerciveText(DISMISS_HINT);
  assertChoiceSymmetry(state.vm.choices.map((c) => c.weight)); // I-13

  const choices: RenderedChoice[] = state.vm.choices.map((c) => ({
    choice: c.choice,
    label: c.label,
    enabled: state.choicesEnabled,
    style: CHOICE_RENDER_STYLE, // same reference for every choice
    emphasis: 'none',
  }));

  const holdProgress =
    state.vm.holdMs > 0 ? clamp01(1 - state.holdRemainingMs / state.vm.holdMs) : 1;

  return {
    phase: state.phase,
    bodyText: state.vm.bodyText,
    holdRemainingMs: state.holdRemainingMs,
    holdProgress,
    showsHoldIndicator: state.phase === 'holding',
    choices,
    dismiss: { target: 'fullscreen-background', hint: DISMISS_HINT },
  };
}
