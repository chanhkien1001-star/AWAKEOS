/**
 * `createNativeEventSource` — production wiring of Stage 1.
 *
 *   native module  ──push (emitter)──┐
 *                                    ├─▶ core EventCollector ──▶ EventSource.pull()
 *   native module  ──pull (drain)────┘
 *
 * The push channel keeps latency low; the pull-time drain is a backstop for
 * anything the OS buffered while JS was asleep. Both paths funnel through the
 * same core `EventCollector`, so normalization, de-bounce, ordering and the
 * I-02 / I-09 guards apply once, in one place.
 */

import type { Event, EventCollector, EventSource, PipelineTelemetry } from '@awake-os/core';
import { noopTelemetry } from '@awake-os/core';
import type {
  AwakeEventCollectorNative,
  CollectorPermission,
  NativeCollectorStartOptions,
  NativeSubscription,
  RawEventEmitter,
} from './native-module.ts';

export interface NativeEventSourceDeps {
  readonly native: AwakeEventCollectorNative;
  readonly emitter: RawEventEmitter;
  readonly collector: EventCollector;
  readonly telemetry?: PipelineTelemetry;
}

export interface NativeEventSource extends EventSource {
  /** Ask the OS for access and begin observing. */
  start(options?: Partial<NativeCollectorStartOptions>): Promise<{ permission: CollectorPermission }>;
  stop(): Promise<void>;
  /** Remove the push subscription. Call on teardown. */
  dispose(): void;
}

const DEFAULT_OBSERVE = { screenState: true, applicationState: true } as const;
const DEFAULT_USAGE_POLL_MS = 5_000;

export function createNativeEventSource(deps: NativeEventSourceDeps): NativeEventSource {
  const tel = deps.telemetry ?? noopTelemetry;
  let subscription: NativeSubscription | null = null;

  function subscribe(): void {
    if (subscription) return;
    subscription = deps.emitter.addListener('awake:rawEventBatch', (batch) => {
      const summary = deps.collector.ingestRaw(batch);
      tel.stage('ingestion.native.push', { ...summary });
    });
  }

  return {
    async start(options) {
      subscribe();
      const merged: NativeCollectorStartOptions = {
        observe: { ...DEFAULT_OBSERVE, ...options?.observe },
        usagePollIntervalMs: options?.usagePollIntervalMs ?? DEFAULT_USAGE_POLL_MS,
      };
      const { permission } = await deps.native.start(merged);
      tel.stage('ingestion.native.start', { permission, observe: merged.observe });
      return { permission };
    },

    async stop() {
      await deps.native.stop();
      tel.stage('ingestion.native.stop', {});
    },

    dispose() {
      subscription?.remove();
      subscription = null;
    },

    async pull(): Promise<readonly Event[]> {
      // Backstop: fold in anything the OS buffered natively, then drain the core
      // collector (which now holds both push- and pull-delivered signals).
      subscribe();
      try {
        const buffered = await deps.native.drainPendingEvents();
        if (buffered.length > 0) {
          const summary = deps.collector.ingestRaw(buffered);
          tel.stage('ingestion.native.drain', { ...summary });
        }
      } catch (err) {
        tel.stage('ingestion.native.drain.error', { message: String(err) });
      }
      return deps.collector.pull();
    },
  };
}
