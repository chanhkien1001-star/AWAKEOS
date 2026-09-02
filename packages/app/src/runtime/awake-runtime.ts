/**
 * `createAwakeRuntime` — assembles the whole engine from ports.
 *
 *   EventSource ─(consent filter)─┐
 *   Encryption ──────────┬────────┼─▶ PersistentLocalStore ─▶ LocalBaselineProvider ─┐
 *   StorageBackend ──────┘        │                                                  │
 *   ChoiceProvider ───────────────┴──────────────────────────────────────────────────▶ Pipeline
 *
 * A host app passes the platform ports (native collector, MMKV backend, AES-GCM
 * key, the Awareness Window presenter) plus the person's `UserSettings`; tests
 * pass stubs. Everything above the ports is the pure core.
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
import { createConsentFilteredEventSource } from '../settings/consent-filtered-event-source.ts';
import { mapSettingsToRuntimeConfig, type SettingsStore, type UserSettings } from '../settings/user-settings.ts';

export interface AwakeRuntimeDeps {
  readonly eventSource: EventSource;
  readonly choiceProvider: ChoiceProvider;
  readonly storageBackend: StorageBackend;
  readonly encryption: EncryptionPort;
  readonly clock: Clock;
  readonly ids: IdFactory;
  readonly telemetry?: PipelineTelemetry;
  /** The person's settings — mapped to pipeline + retention config, and used for the consent filter. */
  readonly settings?: UserSettings;
  /** When given, `eraseAllData()` also resets settings to defaults. */
  readonly settingsStore?: SettingsStore;
  /** Explicit overrides applied on top of anything derived from `settings`. */
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
  tick(): Promise<readonly PipelineOutcome[]>;
  reflect(startMs: number, endMs: number): Promise<ReflectionMirror>;
  prune(nowMs?: number): Promise<PruneSummary>;
  invalidateBaseline(): void;
  /** Erase all on-device usage data (and settings, if a `settingsStore` was provided). */
  eraseAllData(): Promise<void>;
}

export function createAwakeRuntime(deps: AwakeRuntimeDeps): AwakeRuntime {
  const fromSettings = deps.settings
    ? mapSettingsToRuntimeConfig(deps.settings)
    : { pipeline: {} as Partial<PipelineConfig>, retention: {} as Partial<RetentionPolicy> };

  const store = createPersistentLocalStore({
    backend: deps.storageBackend,
    encryption: deps.encryption,
    clock: deps.clock,
    retention: { ...fromSettings.retention, ...deps.retention },
  });

  const baselineProvider = createLocalBaselineProvider({
    store,
    clock: deps.clock,
    ...(deps.baseline?.coverageDays !== undefined ? { coverageDays: deps.baseline.coverageDays } : {}),
    ...(deps.baseline?.recomputeEveryMs !== undefined ? { recomputeEveryMs: deps.baseline.recomputeEveryMs } : {}),
    ...(deps.baseline?.segmenter !== undefined ? { segmenter: deps.baseline.segmenter } : {}),
  });

  const eventSource = deps.settings
    ? createConsentFilteredEventSource(deps.eventSource, () => deps.settings!.observedApps)
    : deps.eventSource;

  const pipeline = createPipeline({
    eventSource,
    choiceProvider: deps.choiceProvider,
    store,
    ids: deps.ids,
    clock: deps.clock,
    getBaseline: () => baselineProvider.getBaseline(),
    ...(deps.telemetry !== undefined ? { telemetry: deps.telemetry } : {}),
    config: { ...fromSettings.pipeline, ...deps.pipeline },
  });

  return {
    store,
    pipeline,
    tick: () => pipeline.tick(),
    reflect: (startMs, endMs) => pipeline.reflect(startMs, endMs),
    prune: (nowMs) => store.prune(nowMs),
    invalidateBaseline: () => baselineProvider.invalidate(),
    async eraseAllData() {
      await store.wipe();
      baselineProvider.invalidate();
      if (deps.settingsStore) await deps.settingsStore.reset();
    },
  };
}
