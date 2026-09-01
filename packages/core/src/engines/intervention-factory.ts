/**
 * STAGE 6 — [INTERVENTION] -> [AWARENESS WINDOW]   (pure)   ***STUB COPY***
 *
 * Only reached when Stage 5 returned `Intervene`. Builds the Intervention and the
 * Awareness Window that the ChoiceProvider will render.
 *
 * Invariants enforced here:
 *  - I-12 Non-Coercive Transparency: `payloadText` states the observed structure
 *    and *why* the window opened. Runs through `assertNonCoerciveText` — a
 *    judgmental or pressuring string throws at build time.
 *  - I-05 Minimum Necessary Intervention: `activeDurationMs` is a 2000-5000ms hold.
 *  - I-08 Reversibility: `modalitySpec` is always dismissible and never hard-blocks
 *    input; `assertReversible` guards it.
 *
 * The copy strings below are placeholders for Step 4 (final UX wording review).
 */

import type { Context } from '../contracts/context.contract.ts';
import type { InterventionCandidate } from '../contracts/intervention-candidate.contract.ts';
import type {
  AwarenessWindow,
  Intervention,
  InterventionModality,
} from '../contracts/intervention.contract.ts';
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

const MIN_HOLD_MS = 2_000;
const MAX_HOLD_MS = 5_000;
const clampHold = (ms: number) => Math.max(MIN_HOLD_MS, Math.min(MAX_HOLD_MS, ms));

function modalityFor(pattern: Pattern): ModalitySpec {
  switch (pattern.category) {
    case 'ExtendedDuration':
      return { modality: 'VisualPauseOverlay', dismissible: true, blocksInput: false, activeDurationMs: 4_000 };
    case 'RapidTransition':
      return { modality: 'ContextualPrompt', dismissible: true, blocksInput: false, activeDurationMs: 3_000 };
    case 'Repetition':
      return { modality: 'HapticPulse', dismissible: true, blocksInput: false, activeDurationMs: 2_000 };
    case 'TemporalDensity':
    default:
      return { modality: 'VisualPauseOverlay', dismissible: true, blocksInput: false, activeDurationMs: 3_000 };
  }
}

/** Transparent, structural sentence describing what was observed (I-12). */
function describe(pattern: Pattern, context: Context): string {
  const m = pattern.metrics;
  switch (pattern.structuralName) {
    case 'ExtendedContinuousInteractionPattern': {
      const minutes = Math.round(context.sequence.activeSubjectDurationMs / 60_000);
      return `Current application has been in the foreground for ${minutes} minutes without a break.`;
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
      return `A structural pattern (${pattern.structuralName}) crossed its threshold.`;
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
): BuiltIntervention {
  const modalitySpec = modalityFor(pattern);
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
    modality: modalitySpec.modality,
    payloadText,
  };

  const awarenessWindow: AwarenessWindow = {
    id: ids.uuid(),
    interventionId: intervention.id,
    openedAt: triggeredAt,
    activeDurationMs: clampHold(modalitySpec.activeDurationMs),
  };

  return { intervention, awarenessWindow, modalitySpec };
}
