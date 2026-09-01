/**
 * STAGE 1 — [EVENT] · the wire shape.
 *
 * `RawNativeEvent` is what a platform adapter pushes across the bridge. It is
 * deliberately LOOSE and flat (easy to marshal over the React Native bridge and
 * to serialise): every field is a primitive, nothing is trusted. The normalizer
 * (`normalizeEvent`) is the only thing allowed to turn one of these into a
 * contract-valid `Event`.
 *
 * The adapter's job is to fill this in from an OS signal and nothing more — no
 * interpretation, no derived fields (I-02).
 */

export interface RawNativeEvent {
  /** Optional adapter-supplied id. Regenerated if absent or malformed. */
  readonly id?: string | null;
  /** Native clock, Unix epoch UTC milliseconds. */
  readonly occurredAt: number;
  /** Must be one of the `EventType` literals. */
  readonly type: string;
  readonly sourceType?: string | null; // 'System' | 'User'
  readonly sourceId?: string | null;
  readonly subjectType?: string | null; // 'Device' | 'Screen' | 'Application' | 'UserInput'
  readonly subjectId?: string | null;
  /**
   * Flat payload. Allowed keys depend on `type` and are enforced by the
   * normalizer — anything else is rejected as a `DisallowedPayloadField` (I-02).
   *   ScreenStateChanged      -> { state }
   *   ApplicationStateChanged -> { state, packageNameHash }
   *   ExplicitInputReceived   -> { actionId, value? }
   */
  readonly payload: Readonly<Record<string, unknown>>;
  /** If present, must equal the frozen Event schema version. */
  readonly schemaVersion?: string | null;
}

/** Convenience constructors used by the app bridge and by tests. */
export const RawNativeEvents = {
  screen(state: 'On' | 'Off' | 'Unlocked' | 'Locked', occurredAt: number, sourceId = 'os.screen'): RawNativeEvent {
    return { occurredAt, type: 'ScreenStateChanged', sourceType: 'System', sourceId, subjectType: 'Screen', payload: { state } };
  },
  application(
    state: 'Foreground' | 'Background' | 'Terminated',
    packageNameHash: string,
    occurredAt: number,
    sourceId = 'os.usage-events',
  ): RawNativeEvent {
    return {
      occurredAt,
      type: 'ApplicationStateChanged',
      sourceType: 'System',
      sourceId,
      subjectType: 'Application',
      subjectId: packageNameHash,
      payload: { state, packageNameHash },
    };
  },
  explicitInput(actionId: string, occurredAt: number, value?: string | number | boolean): RawNativeEvent {
    return {
      occurredAt,
      type: 'ExplicitInputReceived',
      sourceType: 'User',
      sourceId: 'app.ui',
      subjectType: 'UserInput',
      payload: value === undefined ? { actionId } : { actionId, value },
    };
  },
} as const;
