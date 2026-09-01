/**
 * View-model for the Awareness Window overlay. Pure: (Intervention,
 * AwarenessWindow) -> everything the renderer needs, with no framework imports.
 *
 * - `bodyText` is the Intervention's own transparent copy (I-12); it is re-checked
 *   here with `assertNonCoerciveText` so a bad string cannot reach the screen.
 * - The choice set is fixed and symmetrical (I-13). `Continue` is listed first
 *   only because something has to be; it is not the default.
 * - `holdMs` is the Awareness Window's 2-5s hold (I-05).
 */

import type { AwarenessWindow, Intervention } from '@awake-os/core';
import { assertNonCoerciveText } from '@awake-os/core';
import { buildChoiceControls, type ChoiceControlModel } from './choice-symmetry.ts';

export interface AwarenessWindowViewModel {
  readonly windowId: string;
  readonly interventionId: string;
  readonly modality: Intervention['modality'];
  readonly bodyText: string;
  readonly holdMs: number;
  readonly choices: readonly ChoiceControlModel[];
  /** Every window is escapable without choosing (I-08). This gesture emits `Dismiss`. */
  readonly dismissOnBackgroundTap: true;
}

const STANDARD_CHOICES = [
  { choice: 'Continue' as const, label: 'Continue' },
  { choice: 'Exit' as const, label: 'Exit' },
  { choice: 'ChangeContext' as const, label: 'Change context' },
  { choice: 'Postpone' as const, label: 'Later' },
];

export function toAwarenessWindowViewModel(
  intervention: Intervention,
  awarenessWindow: AwarenessWindow,
): AwarenessWindowViewModel {
  assertNonCoerciveText(intervention.payloadText);
  return {
    windowId: awarenessWindow.id,
    interventionId: intervention.id,
    modality: intervention.modality,
    bodyText: intervention.payloadText,
    holdMs: awarenessWindow.activeDurationMs,
    choices: buildChoiceControls(STANDARD_CHOICES),
    dismissOnBackgroundTap: true,
  };
}
