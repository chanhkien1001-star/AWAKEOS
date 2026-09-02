/**
 * STAGE 5 support — the intervention fatigue model   (pure, state-free)
 *
 * `computeInterventionFatigue` turns the person's recent intervention history
 * into the `InterventionFatigue` term the policy maths subtracts. It embodies
 * I-05 (Minimum Necessary Intervention) and I-01 (Agency Above Compliance):
 *
 *  - fatigue DECAYS over time (exponential half-life) — a nudge an hour ago
 *    weighs less than one a minute ago;
 *  - interventions of the SAME structural category weigh more — don't keep
 *    pointing at the same structure;
 *  - CHOICE FEEDBACK: if the person consciously chose to keep going
 *    (`Continue` / `Dismiss` / `Postpone` / `ExplicitlyConfirmIntent`), that
 *    raises fatigue further — they have made their decision, respect it. These
 *    multipliers only ever RAISE fatigue (fewer future interventions); nothing
 *    here can push the system toward intervening *more*.
 *
 * It reports a structural number, never a judgment about the person (I-07).
 */

import type { ChoiceType } from '../contracts/human-choice.contract.ts';
import type { PatternCategory } from '../contracts/pattern.contract.ts';

export interface PriorInterventionSummary {
  readonly triggeredAt: number;
  readonly category: PatternCategory;
  /** The choice the person made in that Awareness Window, if they made one. */
  readonly choice?: ChoiceType;
}

export interface FatigueConfig {
  /** An intervention's weight halves every `halfLifeMs`. */
  readonly halfLifeMs: number;
  /** Interventions older than this are ignored entirely. */
  readonly windowMs: number;
  /** Fatigue added per in-window intervention, before decay and multipliers. */
  readonly perInterventionCost: number;
  /** Extra weight applied to the pattern's own category tally. */
  readonly sameCategoryMultiplier: number;
  /**
   * Per-choice multipliers. All are >= 1: choice feedback can only make the
   * system quieter, never louder.
   */
  readonly choiceMultipliers: Readonly<Record<ChoiceType, number>>;
}

export const DEFAULT_FATIGUE_CONFIG: FatigueConfig = Object.freeze({
  halfLifeMs: 45 * 60_000,
  windowMs: 3 * 60 * 60_000,
  perInterventionCost: 0.18,
  sameCategoryMultiplier: 1.8,
  choiceMultipliers: Object.freeze({
    Continue: 2.2,
    Dismiss: 2.0,
    Postpone: 1.6,
    ExplicitlyConfirmIntent: 2.5,
    ChangeContext: 1.0,
    Exit: 1.0,
  }),
});

export interface FatigueResult {
  /** Overall recent interruption load, across every category. */
  readonly global: number;
  /** Per-category tallies (already includes `sameCategoryMultiplier`). */
  readonly byCategory: Readonly<Partial<Record<PatternCategory, number>>>;
}

export function computeInterventionFatigue(
  priors: readonly PriorInterventionSummary[],
  now: number,
  config: FatigueConfig = DEFAULT_FATIGUE_CONFIG,
): FatigueResult {
  let global = 0;
  const byCategory: Partial<Record<PatternCategory, number>> = {};

  for (const p of priors) {
    const age = now - p.triggeredAt;
    if (age < 0 || age > config.windowMs) continue;

    const decay = Math.pow(0.5, age / config.halfLifeMs);
    const choiceMult = p.choice ? (config.choiceMultipliers[p.choice] ?? 1) : 1;
    const base = config.perInterventionCost * decay * choiceMult;

    global += base;
    byCategory[p.category] = (byCategory[p.category] ?? 0) + base * config.sameCategoryMultiplier;
  }

  return { global, byCategory };
}

/** The effective fatigue index the policy maths uses for one candidate pattern. */
export function fatigueIndexFor(result: FatigueResult, category: PatternCategory): number {
  return Math.max(result.global, result.byCategory[category] ?? 0);
}
