/**
 * STAGE 6 — [INTERVENTION] -> [AWARENESS WINDOW]   (pure, state-free)
 *
 * Only reached when Stage 5 returned `Intervene`. Builds the Intervention and the
 * Awareness Window the ChoiceProvider renders.
 *
 * Invariants enforced here:
 *  - I-12 Non-Coercive Transparency: `payloadText` states the observed structure
 *    and *why* the window opened, in plain words. `assertNonCoerciveText` throws
 *    on any judgmental or pressuring string at build time.
 *  - I-05 Minimum Necessary Intervention: `activeDurationMs` is a short hold
 *    (2000-5000ms), scaled modestly by salience and the rest-period context.
 *  - I-08 Reversibility: `modalitySpec` is always dismissible and never
 *    hard-blocks input; `assertReversible` guards it.
 *
 * Modality is the primary sensory channel; the choice controls are always
 * present regardless (I-13). It is chosen from the candidate salience and the
 * context, not from any inferred state.
 */

import type { Context } from '../contracts/context.contract.ts';
import type { InterventionCandidate } from '../contracts/intervention-candidate.contract.ts';
import type { AwarenessWindow, Intervention, InterventionModality } from '../contracts/intervention.contract.ts';
import type { Pattern } from '../contracts/pattern.contract.ts';
import { assertNonCoerciveText, assertReversible } from '../invariants/invariants.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';

export interface ModalitySpec {
  readonly modality: InterventionModality;
  readonly dismissible: boolean;
  readonly blocksInput: boolean;
  readonly activeDurationMs: number;
}

export interface InterventionFactoryConfig {
  readonly minHoldMs: number;
  readonly maxHoldMs: number;
  /** Base hold before the salience term. */
  readonly holdBaseMs: number;
  /** Added to the hold, scaled by candidate salience. */
  readonly holdSalienceMs: number;
  /** Added to the hold during a user-defined rest period. */
  readonly holdRestBonusMs: number;
  /** At or above this salience, use a ContextualPrompt (a considered choice). */
  readonly contextualPromptSalienceThreshold: number;
}

export const DEFAULT_INTERVENTION_FACTORY_CONFIG: InterventionFactoryConfig = Object.freeze({
  minHoldMs: 2_000,
  maxHoldMs: 5_000,
  holdBaseMs: 2_500,
  holdSalienceMs: 1_500,
  holdRestBonusMs: 500,
  contextualPromptSalienceThreshold: 0.75,
});

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function chooseModality(
  pattern: Pattern,
  context: Context,
  salience: number,
  cfg: InterventionFactoryConfig,
): InterventionModality {
  if (salience >= cfg.contextualPromptSalienceThreshold && !context.temporal.isUserDefinedRestPeriod) {
    return 'ContextualPrompt';
  }
  if (context.temporal.isUserDefinedRestPeriod) return 'VisualPauseOverlay';
  if (pattern.category === 'Repetition') return 'HapticPulse';
  return 'VisualPauseOverlay';
}

function holdMs(context: Context, salience: number, cfg: InterventionFactoryConfig): number {
  const rest = context.temporal.isUserDefinedRestPeriod ? cfg.holdRestBonusMs : 0;
  return clamp(cfg.holdBaseMs + cfg.holdSalienceMs * salience + rest, cfg.minHoldMs, cfg.maxHoldMs);
}

/** A transparent, structural sentence describing what was observed (I-12). */
function describe(pattern: Pattern, context: Context): string {
  const m = pattern.metrics;
  switch (pattern.structuralName) {
    case 'ExtendedContinuousInteractionPattern': {
      const minutes = Math.round(context.sequence.activeSubjectDurationMs / 60_000);
      return `The current application has been in the foreground for about ${minutes} minutes without a break.`;
    }
    case 'RapidRepeatedTransition': {
      const seconds = Math.round(m.totalDurationMs / 1000);
      return `${m.transitionCount} application switches in the last ${seconds} seconds.`;
    }
    case 'HighTemporalEventDensity':
      return `${context.sequence.eventsInLastWindow} interactions recorded in the last minute.`;
    case 'RepeatedDiscreteInputPattern':
      return `The same action was recorded ${m.transitionCount} times in a row.`;
    default:
      return `A structural threshold for ${pattern.structuralName} was crossed.`;
  }
}

export interface BuiltIntervention {
  readonly intervention: Intervention;
  readonly awarenessWindow: AwarenessWindow;
  readonly modalitySpec: ModalitySpec;
}

export function buildIntervention(
  candidate: InterventionCandidate,
  pattern: Pattern,
  context: Context,
  ids: IdFactory,
  clock: Clock,
  config: InterventionFactoryConfig = DEFAULT_INTERVENTION_FACTORY_CONFIG,
): BuiltIntervention {
  const modality = chooseModality(pattern, context, candidate.salienceScore, config);
  const modalitySpec: ModalitySpec = {
    modality,
    dismissible: true,
    blocksInput: false,
    activeDurationMs: holdMs(context, candidate.salienceScore, config),
  };
  assertReversible(modalitySpec); // I-08

  const payloadText =
    `Awareness Window. ${describe(pattern, context)} ` +
    `This window opened because a structural threshold was crossed. Your choice.`;
  assertNonCoerciveText(payloadText); // I-12 / I-10 / I-07

  const triggeredAt = clock.now();
  const intervention: Intervention = {
    id: ids.uuid(),
    candidateId: candidate.id,
    triggeredAt,
    modality,
    payloadText,
  };

  const awarenessWindow: AwarenessWindow = {
    id: ids.uuid(),
    interventionId: intervention.id,
    openedAt: triggeredAt,
    activeDurationMs: modalitySpec.activeDurationMs,
  };

  return { intervention, awarenessWindow, modalitySpec };
}
