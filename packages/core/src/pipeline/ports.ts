/**
 * PORTS — the seams between the pure core and the outside world.
 *
 * The core never imports a platform SDK, a UI toolkit, or a database. It talks to
 * these interfaces. Native adapters (Kotlin/Swift) and the app shell (React
 * Native) provide the implementations; tests provide stubs.
 */

import type { Event } from '../contracts/event.contract.ts';
import type { Intervention, AwarenessWindow } from '../contracts/intervention.contract.ts';
import type { HumanChoice } from '../contracts/human-choice.contract.ts';
import type { ReflectionMirror } from '../contracts/reflection.contract.ts';
import type { PriorInterventionSummary } from '../engines/fatigue.ts';

/**
 * Emits normalized Event objects observed from the OS.
 * Real implementation: platform adapters (see packages/adapters). I-02: this port
 * may only surface observed facts.
 */
export interface EventSource {
  /** Drain any Events observed since the last pull, oldest first. */
  pull(): Promise<readonly Event[]>;
}

/**
 * Renders an Awareness Window and returns the human's choice.
 * Real implementation: the Awareness Window UI (packages/app). It MUST enforce
 * I-13 Choice Symmetry and I-08 Reversibility. `Dismiss` is a valid return.
 */
export interface ChoiceProvider {
  present(window: AwarenessWindow, intervention: Intervention): Promise<HumanChoice>;
}

/**
 * One fired intervention and the choice it drew, persisted locally so the
 * fatigue model survives process restarts. Not a frozen wire contract — it is
 * internal bookkeeping that composes the frozen Intervention / HumanChoice.
 */
export interface InterventionRecord extends PriorInterventionSummary {
  readonly interventionId: string;
  readonly candidateId: string;
  readonly patternId: string;
  readonly awarenessWindowId: string;
  readonly choiceAt?: number;
}

/**
 * Local-first persistence (I-09). Everything here lives on-device by default.
 * Sync, if it ever exists, is a separate opt-in adapter the user controls.
 */
export interface LocalStore {
  appendEvent(event: Event): Promise<void>;
  appendChoice(choice: HumanChoice): Promise<void>;
  appendInterventionRecord(record: InterventionRecord): Promise<void>;
  saveReflection(mirror: ReflectionMirror): Promise<void>;
  /** Events within [start, end) ms, oldest first. */
  readEvents(startMs: number, endMs: number): Promise<readonly Event[]>;
  readChoices(startMs: number, endMs: number): Promise<readonly HumanChoice[]>;
  /** Intervention records with `triggeredAt` within [start, end) ms, oldest first. */
  readInterventionRecords(startMs: number, endMs: number): Promise<readonly InterventionRecord[]>;
}

/** Optional structured trace of every stage, including each Silence (I-04). */
export interface PipelineTelemetry {
  stage(name: string, detail: Record<string, unknown>): void;
}

export const noopTelemetry: PipelineTelemetry = { stage: () => {} };
