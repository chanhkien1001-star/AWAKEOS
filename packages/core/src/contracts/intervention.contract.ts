/**
 * CONTRACT 6 / 8 — INTERVENTION & AWARENESS WINDOW  (FROZEN — do not modify)
 *
 * Pipeline stage: [INTERVENTION] -> [AWARENESS WINDOW]
 * Data boundary : Layer 3 — Action.
 *
 * Invariants enforced here:
 *  - I-08 Reversibility of Intervention: every modality is instantly dismissible
 *    / escapable. An Awareness Window can always be left with a single gesture.
 *  - I-12 Non-Coercive Transparency: `payloadText` states, plainly, the observed
 *    structure and the fact that a window was opened. It never asks "Are you
 *    sure?", never accuses, never shames.
 *  - I-05 Minimum Necessary Intervention: `activeDurationMs` is a short hold
 *    (2000ms - 5000ms), just long enough to break autopilot.
 */

export const INTERVENTION_SCHEMA_VERSION = '1.0.0' as const;

export type InterventionModality =
  | 'HapticPulse'
  | 'VisualPauseOverlay'
  | 'ContextualPrompt';

export interface Intervention {
  readonly id: string;
  readonly candidateId: string;
  readonly triggeredAt: number;
  readonly modality: InterventionModality;
  readonly payloadText: string; // Non-coercive, transparent wording
}

export interface AwarenessWindow {
  readonly id: string;
  readonly interventionId: string;
  readonly openedAt: number;
  readonly activeDurationMs: number; // Typically 2000ms - 5000ms hold
}
