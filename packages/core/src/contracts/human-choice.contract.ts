/**
 * CONTRACT 7 / 8 — HUMAN CHOICE  (FROZEN — do not modify)
 *
 * Pipeline stage: [HUMAN CHOICE]
 * Data boundary : Layer 4 — Human Sovereignty.
 *
 * This is the only stage where *meaning* enters the system.
 *
 * Invariants enforced here:
 *  - I-03 Human Meaning Sovereignty: only the human writes `userSovereignNote`;
 *    the system never fills, suggests, or interprets it.
 *  - I-13 Choice Symmetry: every `ChoiceType` presented in a given window is
 *    rendered with identical visual / interactive weight. `Continue` is not a
 *    "failure" branch and `Exit` is not a "success" branch.
 *  - I-01 Agency Above Compliance: all choices below are valid, complete
 *    outcomes — including `Continue` and `Dismiss`.
 */

export const HUMAN_CHOICE_SCHEMA_VERSION = '1.0.0' as const;

export type ChoiceType =
  | 'Continue'
  | 'Exit'
  | 'ChangeContext'
  | 'Postpone'
  | 'ExplicitlyConfirmIntent'
  | 'Dismiss';

export interface HumanChoice {
  readonly id: string;
  readonly awarenessWindowId: string;
  readonly selectedAt: number;
  readonly choice: ChoiceType;
  readonly userSovereignNote?: string; // Optional user tag
}
