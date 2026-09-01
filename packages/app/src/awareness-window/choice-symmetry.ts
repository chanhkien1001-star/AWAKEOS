/**
 * CHOICE SYMMETRY (I-13) — the single source of truth for how choice controls
 * are sized and animated in an Awareness Window.
 *
 * There is exactly ONE weight token. Every choice in a window is rendered with
 * it. The only things allowed to differ between choices are: the label, the
 * `order`, and the `ChoiceType` the press emits. No primary/secondary styling,
 * no colour emphasis, no auto-focus, no "recommended" tag — none of it.
 */

import type { ChoiceType } from '@awake-os/core';
import { assertChoiceSymmetry, type ChoiceWeight } from '@awake-os/core';

/** The one and only visual weight shared by every choice control. */
export const SYMMETRIC_CHOICE_WEIGHT: Readonly<Omit<ChoiceWeight, 'order' | 'autoFocused'>> = Object.freeze({
  fontSizePx: 17,
  widthPx: 160,
  heightPx: 52,
  backgroundOpacity: 0.08,
  animationMs: 140,
});

export interface ChoiceControlModel {
  readonly choice: ChoiceType;
  readonly label: string;
  readonly weight: ChoiceWeight;
}

/**
 * Build the choice controls for a window. Order is presentation order only and
 * carries no meaning. The result is passed through `assertChoiceSymmetry` before
 * it is returned — a caller cannot construct an asymmetric set.
 */
export function buildChoiceControls(
  choices: readonly { readonly choice: ChoiceType; readonly label: string }[],
): readonly ChoiceControlModel[] {
  const controls = choices.map((c, i) => ({
    choice: c.choice,
    label: c.label,
    weight: { ...SYMMETRIC_CHOICE_WEIGHT, order: i, autoFocused: false } satisfies ChoiceWeight,
  }));
  assertChoiceSymmetry(controls.map((c) => c.weight)); // I-13 hard guard
  return controls;
}
