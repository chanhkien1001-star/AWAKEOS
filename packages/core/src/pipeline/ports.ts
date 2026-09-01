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
 * Local-first persistence (I-09). Everything here lives on-device by default.
 * Sync, if it ever exists, is a separate opt-in adapter the user controls.
 */
export interface LocalStore {
  appendEvent(event: Event): Promise<void>;
  appendChoice(choice: HumanChoice): Promise<void>;
  saveReflection(mirror: ReflectionMirror): Promise<void>;
  /** Events within [start, end) ms, oldest first. */
  readEvents(startMs: number, endMs: number): Promise<readonly Event[]>;
  readChoices(startMs: number, endMs: number): Promise<readonly HumanChoice[]>;
}

/** Optional structured trace of every stage, including each Silence (I-04). */
export interface PipelineTelemetry {
  stage(name: string, detail: Record<string, unknown>): void;
}

export const noopTelemetry: PipelineTelemetry = { stage: () => {} };
