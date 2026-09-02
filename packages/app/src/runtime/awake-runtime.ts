/**
 * `createAwakeRuntime` — assembles the whole engine from ports.
 *
 *   EventSource ─┐
 *   Encryption ──┼─▶ PersistentLocalStore ─▶ LocalBaselineProvider ─┐
 *   StorageBackend┘                                                 │
 *   ChoiceProvider ───────────────────────────────────────────────▶ Pipeline
 *
 * A host app passes the platform ports (native collector, MMKV backend, AES-GCM
 * key, the Awareness Window presenter); tests pass stubs. Everything above the
 * ports is the pure core.
 */

import {
  createPersistentLocalStore,
  createPipeline,
  type ChoiceProvider,
  type Clock,
  type EncryptionPort,
  type EventSource,
  type IdFactory,
  type Pipeline,
  type PipelineConfig,
  type PipelineOutcome,
  type PipelineTelemetry,
  type PersistentLocalStore,
  type PruneSummary,
  type ReflectionMirror,
  type RetentionPolicy,
  type SessionSegmenterConfig,
  type StorageBackend,
} from '@awake-os/core';
import { createLocalBaselineProvider } from '../baseline/local-baseline-provider.ts';

export interface AwakeRuntimeDeps {
  readonly eventSource: EventSource;
  readonly choiceProvider: ChoiceProvider;
  readonly storageBackend: StorageBackend;
  readonly encryption: EncryptionPort;
  readonly clock: Clock;
  readonly ids: IdFactory;
  readonly telemetry?: PipelineTelemetry;
  readonly pipeline?: Partial<PipelineConfig>;
  readonly retention?: Partial<RetentionPolicy>;
  readonly baseline?: {
    readonly coverageDays?: number;
    readonly recomputeEveryMs?: number;
    readonly segmenter?: SessionSegmenterConfig;
  };
}

export interface AwakeRuntime {
  readonly store: PersistentLocalStore;
  readonly pipeline: Pipeline;
  /** Pull pending events through the 8 stages. */
  tick(): Promise<readonly PipelineOutcome[]>;
  /** Build (and persist) a ReflectionMirror over [startMs, endMs). */
  reflect(startMs: number, endMs: number): Promise<ReflectionMirror>;
  /** Apply the retention policy to on-device storage. */
  prune(nowMs?: number): Promise<PruneSummary>;
  /** Recompute the behavioural baseline on the next tick. */
  invalidateBaseline(): void;
}

export function createAwakeRuntime(deps: AwakeRuntimeDeps): AwakeRuntime {
  const store = createPersistentLocalStore({
    backend: deps.storageBackend,
    encryption: deps.encryption,
    clock: deps.clock,
    ...(deps.retention !== undefined ? { retention: deps.retention } : {}),
  });

  const baselineProvider = createLocalBaselineProvider({
    store,
    clock: deps.clock,
    ...(deps.baseline?.coverageDays !== undefined ? { coverageDays: deps.baseline.coverageDays } : {}),
    ...(deps.baseline?.recomputeEveryMs !== undefined ? { recomputeEveryMs: deps.baseline.recomputeEveryMs } : {}),
    ...(deps.baseline?.segmenter !== undefined ? { segmenter: deps.baseline.segmenter } : {}),
  });

  const pipeline = createPipeline({
    eventSource: deps.eventSource,
    choiceProvider: deps.choiceProvider,
    store,
    ids: deps.ids,
    clock: deps.clock,
    getBaseline: () => baselineProvider.getBaseline(),
    ...(deps.telemetry !== undefined ? { telemetry: deps.telemetry } : {}),
    ...(deps.pipeline !== undefined ? { config: deps.pipeline } : {}),
  });

  return {
    store,
    pipeline,
    tick: () => pipeline.tick(),
    reflect: (startMs, endMs) => pipeline.reflect(startMs, endMs),
    prune: (nowMs) => store.prune(nowMs),
    invalidateBaseline: () => baselineProvider.invalidate(),
  };
}
