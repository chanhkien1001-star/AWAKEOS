/**
 * TypeScript contract for the native Event Collector module.
 *
 * The Android (Kotlin) and iOS (Swift) modules under `packages/adapters/` expose
 * exactly this surface across the React Native bridge. Nothing here interprets a
 * signal — the native side only observes and forwards `RawNativeEvent`s (I-02),
 * and it never makes a network call (I-09).
 */

import type { RawNativeEvent } from '@awake-os/core';

export type { RawNativeEvent };

/** Result of asking the OS for the access an adapter needs. */
export type CollectorPermission =
  | 'granted' // everything the platform can give
  | 'partial' // e.g. iOS: host-app lifecycle only, no cross-app visibility
  | 'denied' // user said no
  | 'restricted'; // MDM / parental controls block it

export interface NativeCollectorStatus {
  readonly running: boolean;
  readonly permission: CollectorPermission;
  /** Raw signals observed but not yet delivered to JS. */
  readonly pendingNative: number;
  /** Platform adapter build id, for telemetry. */
  readonly adapterVersion: string;
}

export interface NativeCollectorStartOptions {
  /**
   * Which OS signal families to observe. Screen + application are the Step 1
   * defaults; `explicitInput` is emitted by the app's own UI, not the OS.
   */
  readonly observe: {
    readonly screenState: boolean;
    readonly applicationState: boolean;
  };
  /** Poll cadence for the Android UsageStats reader, ms. Ignored on iOS. Default 5000. */
  readonly usagePollIntervalMs?: number;
}

export interface AwakeEventCollectorNative {
  /** Begin observing. Idempotent. Returns the resulting permission state. */
  start(options: NativeCollectorStartOptions): Promise<{ permission: CollectorPermission }>;
  /** Stop observing and release OS listeners. Idempotent. */
  stop(): Promise<void>;
  /**
   * Hand over every raw signal buffered on the native side and clear that
   * buffer. Used as a backstop for signals observed while JS was asleep.
   */
  drainPendingEvents(): Promise<readonly RawNativeEvent[]>;
  getStatus(): Promise<NativeCollectorStatus>;
  /** Open the OS settings screen where the user grants the special access. */
  openPermissionSettings(): Promise<void>;
}

export interface NativeSubscription {
  remove(): void;
}

/**
 * The push channel. The native module also emits batches as it observes them, so
 * the pipeline reacts promptly instead of only on the next `pull()`.
 */
export interface RawEventEmitter {
  addListener(
    eventType: 'awake:rawEventBatch',
    handler: (batch: readonly RawNativeEvent[]) => void,
  ): NativeSubscription;
}
