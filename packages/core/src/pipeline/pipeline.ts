/**
 * THE 8-STAGE PIPELINE — end-to-end orchestration.
 *
 *   [EVENT] -> [CONTEXT] -> [PATTERN] -> [INTERVENTION CANDIDATE]
 *           -> [INTERVENTION POLICY] -> [INTERVENTION]
 *           -> [AWARENESS WINDOW & HUMAN CHOICE] -> [REFLECTION]
 *
 * The orchestrator owns no domain logic — each stage is a pure function it calls
 * in order. It owns only: pulling events, persisting locally (I-09), carrying the
 * small amount of state the policy maths needs (recent intervention timestamps),
 * and emitting telemetry for every outcome including Silence (I-04).
 *
 * Multi-pattern arbitration (when one Event yields several Patterns) is
 * intentionally minimal here — highest confidence wins — and is a Step 3 concern.
 */

import type { Context } from '../contracts/context.contract.ts';
import type { Event } from '../contracts/event.contract.ts';
import type { HumanChoice } from '../contracts/human-choice.contract.ts';
import type { InterventionCandidate } from '../contracts/intervention-candidate.contract.ts';
import type { InterventionPolicyDecision } from '../contracts/intervention-policy.contract.ts';
import type { AwarenessWindow, Intervention } from '../contracts/intervention.contract.ts';
import type { Pattern } from '../contracts/pattern.contract.ts';
import type { ReflectionMirror } from '../contracts/reflection.contract.ts';

import { buildContext, type ContextBuilderOptions } from '../engines/context-builder.ts';
import { emptyBaseline, type BehavioralBaseline } from '../engines/baseline.ts';
import { generateCandidate, DEFAULT_CANDIDATE_CONFIG, type CandidateGeneratorConfig } from '../engines/candidate-generator.ts';
import {
  buildIntervention,
  DEFAULT_INTERVENTION_FACTORY_CONFIG,
  type InterventionFactoryConfig,
} from '../engines/intervention-factory.ts';
import { decidePolicy, DEFAULT_POLICY_CONFIG, type PolicyConfig, type PolicyTrace } from '../engines/policy-engine.ts';
import { detectPatterns, DEFAULT_PATTERN_CONFIG, type PatternDetectorConfig } from '../engines/pattern-detector.ts';
import {
  arbitratePatterns,
  DEFAULT_ARBITER_CONFIG,
  type ArbiterConfig,
  type SuppressedPattern,
} from '../engines/pattern-arbiter.ts';
import { buildReflectionMirror } from '../engines/reflection-mirror.ts';

import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';
import { noopTelemetry, type ChoiceProvider, type EventSource, type LocalStore, type PipelineTelemetry } from './ports.ts';

export interface PipelineConfig {
  /** How far back the Context/Pattern stages look. Default 6h. */
  readonly lookbackMs: number;
  readonly context: ContextBuilderOptions;
  readonly pattern: PatternDetectorConfig;
  readonly arbiter: ArbiterConfig;
  readonly candidate: CandidateGeneratorConfig;
  readonly interventionFactory: InterventionFactoryConfig;
  readonly policy: PolicyConfig;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = Object.freeze({
  lookbackMs: 6 * 60 * 60_000,
  context: {},
  pattern: DEFAULT_PATTERN_CONFIG,
  arbiter: DEFAULT_ARBITER_CONFIG,
  candidate: DEFAULT_CANDIDATE_CONFIG,
  interventionFactory: DEFAULT_INTERVENTION_FACTORY_CONFIG,
  policy: DEFAULT_POLICY_CONFIG,
});

export interface PipelineDeps {
  readonly eventSource: EventSource;
  readonly choiceProvider: ChoiceProvider;
  readonly store: LocalStore;
  readonly ids: IdFactory;
  readonly clock: Clock;
  readonly telemetry?: PipelineTelemetry;
  readonly config?: Partial<PipelineConfig>;
  /**
   * Supplies the person's `BehavioralBaseline` for Stage 3. Resolved once per
   * `tick()`. Defaults to an empty baseline, under which Stage 3 runs in
   * conservative cold-start mode. Wire this to a locally-stored baseline that the
   * app recomputes on a schedule (`buildBaselineFromEvents`).
   */
  readonly getBaseline?: () => BehavioralBaseline | Promise<BehavioralBaseline>;
}

/** "The Return" — a 2s dark screen with "You are here" after leaving a long session. */
export interface ReturnMoment {
  readonly text: 'You are here';
  readonly hapticBeats: 1;
  readonly autoDismissMs: 2_000;
}

export type PipelineOutcome =
  | {
      readonly kind: 'NoPattern';
      readonly event: Event;
      readonly context: Context;
      /** Patterns that were detected but did not survive arbitration, if any. */
      readonly suppressed: readonly SuppressedPattern[];
    }
  | { readonly kind: 'NoCandidate'; readonly event: Event; readonly context: Context; readonly pattern: Pattern }
  | {
      readonly kind: 'Silence';
      readonly event: Event;
      readonly context: Context;
      readonly pattern: Pattern;
      readonly suppressed: readonly SuppressedPattern[];
      readonly candidate: InterventionCandidate;
      readonly decision: InterventionPolicyDecision;
      readonly trace: PolicyTrace;
    }
  | {
      readonly kind: 'Choice';
      readonly event: Event;
      readonly context: Context;
      readonly pattern: Pattern;
      readonly suppressed: readonly SuppressedPattern[];
      readonly candidate: InterventionCandidate;
      readonly decision: InterventionPolicyDecision;
      readonly trace: PolicyTrace;
      readonly intervention: Intervention;
      readonly awarenessWindow: AwarenessWindow;
      readonly choice: HumanChoice;
      readonly returnMoment?: ReturnMoment;
    };

export interface Pipeline {
  /** Pull all pending events and run each through the 8 stages, in order. */
  tick(): Promise<readonly PipelineOutcome[]>;
  /** Build a ReflectionMirror over [startMs, endMs) from patterns seen so far. */
  reflect(startMs: number, endMs: number): Promise<ReflectionMirror>;
}

export function createPipeline(deps: PipelineDeps): Pipeline {
  const cfg: PipelineConfig = {
    ...DEFAULT_PIPELINE_CONFIG,
    ...deps.config,
    context: { ...DEFAULT_PIPELINE_CONFIG.context, ...deps.config?.context },
    pattern: { ...DEFAULT_PIPELINE_CONFIG.pattern, ...deps.config?.pattern },
    arbiter: { ...DEFAULT_PIPELINE_CONFIG.arbiter, ...deps.config?.arbiter },
    candidate: { ...DEFAULT_PIPELINE_CONFIG.candidate, ...deps.config?.candidate },
    interventionFactory: { ...DEFAULT_PIPELINE_CONFIG.interventionFactory, ...deps.config?.interventionFactory },
    policy: {
      ...DEFAULT_PIPELINE_CONFIG.policy,
      ...deps.config?.policy,
      weights: { ...DEFAULT_PIPELINE_CONFIG.policy.weights, ...deps.config?.policy?.weights },
      fatigue: { ...DEFAULT_PIPELINE_CONFIG.policy.fatigue, ...deps.config?.policy?.fatigue },
    },
  };
  const tel = deps.telemetry ?? noopTelemetry;

  // The pipeline holds no state of its own. Fatigue history and the structural
  // record behind the Reflection mirror are both persisted to the local store
  // and re-read on demand (I-09).

  async function processEvent(event: Event, baseline: BehavioralBaseline): Promise<PipelineOutcome> {
    await deps.store.appendEvent(event); // I-09: persist locally first

    const from = event.occurredAt - cfg.lookbackMs;
    const preceding = await deps.store.readEvents(from, event.occurredAt + 1);

    // Stage 2 — CONTEXT
    const context = buildContext(event, preceding, deps.ids, cfg.context);
    tel.stage('context', { eventId: event.id, contextId: context.id });

    // Stage 3 — PATTERN (compared against the person's own baseline)
    const patterns = detectPatterns(preceding, context, baseline, deps.ids, deps.clock, cfg.pattern);
    // The Reflection mirror is a neutral mirror of structure: persist every
    // detected pattern, independent of what arbitration / the policy acts on.
    for (const p of patterns) {
      await deps.store.appendPatternObservation({
        patternId: p.id,
        observedAt: context.timestamp,
        category: p.category,
        structuralName: p.structuralName,
        deviationFromBaselineRatio: p.metrics.deviationFromBaselineRatio,
        timeFrame: context.temporal.timeFrame,
        dayOfWeek: context.temporal.dayOfWeek,
        isUserDefinedRestPeriod: context.temporal.isUserDefinedRestPeriod,
      });
    }

    // Stage 3/4 — ARBITRATION: one event -> at most one structure to act on.
    const { selected: pattern, suppressed } = arbitratePatterns(patterns, context, cfg.arbiter);
    if (!pattern) {
      tel.stage('pattern', { eventId: event.id, detected: patterns.length, selected: null });
      return { kind: 'NoPattern', event, context, suppressed };
    }
    tel.stage('pattern', {
      eventId: event.id,
      detected: patterns.length,
      chosen: pattern.structuralName,
      suppressed: suppressed.map((s) => `${s.pattern.structuralName}:${s.reason}`),
    });

    // Stage 4 — INTERVENTION CANDIDATE
    const candidate = generateCandidate(pattern, context, deps.ids, deps.clock, cfg.candidate);
    if (!candidate) {
      tel.stage('candidate', { patternId: pattern.id, generated: false });
      return { kind: 'NoCandidate', event, context, pattern };
    }
    tel.stage('candidate', { candidateId: candidate.id, salience: candidate.salienceScore });

    // Stage 5 — INTERVENTION POLICY (fatigue read from persisted history, I-09)
    const now = deps.clock.now();
    const priorInterventions = await deps.store.readInterventionRecords(
      now - cfg.policy.fatigue.windowMs,
      now + 1,
    );
    const { decision, trace } = decidePolicy({
      candidate,
      pattern,
      context,
      priorInterventions,
      now,
      config: cfg.policy,
    });
    tel.stage('policy', {
      candidateId: candidate.id,
      decision: decision.decision,
      reason: decision.decisionReason,
      decisionScore: trace.decisionScore,
      fatigueIndex: decision.fatigueIndex,
    });

    if (decision.decision === 'Silence') {
      // I-04: Silence is a first-class, logged outcome — not a failure path.
      return { kind: 'Silence', event, context, pattern, suppressed, candidate, decision, trace };
    }

    // Stage 6 — INTERVENTION + AWARENESS WINDOW
    const { intervention, awarenessWindow } = buildIntervention(
      candidate,
      pattern,
      context,
      deps.ids,
      deps.clock,
      cfg.interventionFactory,
    );
    tel.stage('intervention', { interventionId: intervention.id, modality: intervention.modality });

    // Stage 7 — HUMAN CHOICE (rendered by the ChoiceProvider port)
    const choice = await deps.choiceProvider.present(awarenessWindow, intervention);
    await deps.store.appendChoice(choice);
    await deps.store.appendInterventionRecord({
      interventionId: intervention.id,
      candidateId: candidate.id,
      patternId: pattern.id,
      awarenessWindowId: awarenessWindow.id,
      category: pattern.category,
      triggeredAt: intervention.triggeredAt,
      choice: choice.choice,
      choiceAt: choice.selectedAt,
    });
    tel.stage('choice', { awarenessWindowId: awarenessWindow.id, choice: choice.choice });

    const returnMoment: ReturnMoment | undefined =
      choice.choice === 'Exit' && pattern.category === 'ExtendedDuration'
        ? { text: 'You are here', hapticBeats: 1, autoDismissMs: 2_000 }
        : undefined;

    return returnMoment === undefined
      ? { kind: 'Choice', event, context, pattern, suppressed, candidate, decision, trace, intervention, awarenessWindow, choice }
      : { kind: 'Choice', event, context, pattern, suppressed, candidate, decision, trace, intervention, awarenessWindow, choice, returnMoment };
  }

  return {
    async tick() {
      const events = await deps.eventSource.pull();
      const ordered = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
      const baseline = deps.getBaseline ? await deps.getBaseline() : emptyBaseline(deps.clock.now());
      tel.stage('baseline', { totalSessions: baseline.totalSessions, coverageDays: baseline.coverageDays });
      const outcomes: PipelineOutcome[] = [];
      for (const event of ordered) outcomes.push(await processEvent(event, baseline));
      return outcomes;
    },

    async reflect(startMs, endMs) {
      // Stage 8 — REFLECTION, rebuilt from the persisted structural record.
      const observations = await deps.store.readPatternObservations(startMs, endMs);
      const mirror = buildReflectionMirror(
        { observations, timeRangeStart: startMs, timeRangeEnd: endMs },
        deps.ids,
        deps.clock,
      );
      await deps.store.saveReflection(mirror);
      tel.stage('reflection', { mirrorId: mirror.id, facts: mirror.observableFacts.length });
      return mirror;
    },
  };
}
