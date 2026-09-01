/**
 * CONTRACT 1 / 8 — EVENT  (FROZEN — do not modify)
 *
 * Pipeline stage: [EVENT]
 * Data boundary : Layer 1 — Observation (raw facts only).
 *
 * Invariants enforced here:
 *  - I-02 Evidence Before Interpretation: an Event records only what was observed
 *    (screen on/off, app foreground/background, an explicit user input). No mood,
 *    no "focus", no "distraction", no inferred state.
 *  - I-09 Local-First Data Sovereignty: `subject.id` for applications MUST be a
 *    salted hash (`packageNameHash`), never a raw package / bundle id.
 *  - I-11 Structural Naming Only.
 */

export const EVENT_SCHEMA_VERSION = '1.0.0' as const;

export type EventType =
  | 'ScreenStateChanged'
  | 'ApplicationStateChanged'
  | 'ExplicitInputReceived';

export type EventPayload =
  | { readonly state: 'On' | 'Off' | 'Unlocked' | 'Locked' }
  | { readonly state: 'Foreground' | 'Background' | 'Terminated'; readonly packageNameHash: string }
  | { readonly actionId: string; readonly value?: string | number | boolean };

export interface Event {
  readonly id: string; // UUIDv4
  readonly occurredAt: number; // Unix Epoch UTC ms
  readonly type: EventType;
  readonly source: {
    readonly type: 'System' | 'User';
    readonly id: string;
  };
  readonly subject: {
    readonly type: 'Device' | 'Screen' | 'Application' | 'UserInput';
    readonly id?: string;
  };
  readonly payload: EventPayload;
  readonly schemaVersion: string; // "1.0.0"
}
