/**
 * CONTRACT 2 / 8 — CONTEXT  (FROZEN — do not modify)
 *
 * Pipeline stage: [CONTEXT]
 * Data boundary : Layer 1 — Observation (structural framing of an Event).
 *
 * A Context is derived by a pure, state-free function from an Event plus the
 * immediately surrounding Event window. It carries only structural / temporal
 * facts. `isUserDefinedRestPeriod` reflects a boundary the *user* configured;
 * the system never decides on its own that a period is "rest".
 */

export const CONTEXT_SCHEMA_VERSION = '1.0.0' as const;

export type TimeFrameBoundary =
  | '00:00-06:00'
  | '06:00-12:00'
  | '12:00-18:00'
  | '18:00-24:00';

export interface Context {
  readonly id: string;
  readonly timestamp: number;
  readonly referenceEventId: string;
  readonly temporal: {
    readonly timeFrame: TimeFrameBoundary;
    readonly dayOfWeek: number; // 1-7
    readonly isUserDefinedRestPeriod: boolean;
  };
  readonly sequence: {
    readonly eventsInLastWindow: number;
    readonly elapsedSinceLastUnlockMs: number;
    readonly activeSubjectDurationMs: number;
  };
  readonly schemaVersion: string;
}
