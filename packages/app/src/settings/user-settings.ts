/**
 * User settings — the person's own configuration (I-03 Human Meaning Sovereignty,
 * I-09 Local-First). Persisted through the same encrypted `StorageBackend`.
 *
 *  - `restPeriods` feed `ContextBuilderOptions.restPeriods`;
 *  - `observedApps` gates which `ApplicationStateChanged` events are processed
 *    (consent, I-09) — see `consent-filtered-event-source.ts`;
 *  - `interventionsEnabled` is the master switch for Awareness Windows (I-01);
 *  - `retentionDays` overrides the storage retention policy.
 *
 * `mapSettingsToRuntimeConfig` turns settings into the runtime's config shapes —
 * a pure function so it is trivially testable.
 */

import type { EncryptionPort, PipelineConfig, RetentionPolicy, StorageBackend } from '@awake-os/core';

export const USER_SETTINGS_SCHEMA_VERSION = '1.0.0' as const;
const SETTINGS_LOG = 'user-settings';
const DAY = 24 * 60 * 60_000;

export interface RestWindow {
  /** [startHour, endHour) in local time; may wrap midnight (e.g. 23 -> 7). */
  readonly startHour: number;
  readonly endHour: number;
}

export interface UserSettings {
  readonly schemaVersion: string;
  readonly onboardingComplete: boolean;
  /** Master switch for Awareness Windows. The mirror still works when false. */
  readonly interventionsEnabled: boolean;
  readonly restPeriods: readonly RestWindow[];
  readonly observedApps:
    | { readonly mode: 'all' }
    | { readonly mode: 'allowlist'; readonly allow: readonly string[] };
  readonly retentionDays: {
    readonly rawEvents: number;
    readonly patternObservations: number;
    readonly choices: number;
    readonly interventionRecords: number;
    readonly reflections: number;
  };
}

export const DEFAULT_USER_SETTINGS: UserSettings = Object.freeze({
  schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
  onboardingComplete: false,
  interventionsEnabled: true,
  restPeriods: [{ startHour: 23, endHour: 7 }],
  observedApps: { mode: 'all' as const },
  retentionDays: {
    rawEvents: 30,
    patternObservations: 180,
    choices: 30,
    interventionRecords: 14,
    reflections: 365,
  },
});

export interface SettingsStore {
  read(): Promise<UserSettings>;
  /** Merge a partial update and persist. Returns the new settings. */
  update(patch: Partial<UserSettings>): Promise<UserSettings>;
  /** Reset to defaults (used by "erase all data"). */
  reset(): Promise<UserSettings>;
}

function coerce(raw: unknown): UserSettings {
  if (raw === null || typeof raw !== 'object') return DEFAULT_USER_SETTINGS;
  // shallow-merge onto defaults so a new field is always present
  return { ...DEFAULT_USER_SETTINGS, ...(raw as Partial<UserSettings>), schemaVersion: USER_SETTINGS_SCHEMA_VERSION };
}

export function createSettingsStore(deps: {
  readonly backend: StorageBackend;
  readonly encryption: EncryptionPort;
}): SettingsStore {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let cached: UserSettings | null = null;

  async function persist(next: UserSettings): Promise<UserSettings> {
    const bytes = await deps.encryption.encrypt(encoder.encode(JSON.stringify(next)));
    await deps.backend.rewrite(SETTINGS_LOG, [bytes]); // single-record log
    cached = next;
    return next;
  }

  return {
    async read() {
      if (cached) return cached;
      const records = await deps.backend.readAll(SETTINGS_LOG);
      const last = records.at(-1);
      cached = last ? coerce(JSON.parse(decoder.decode(await deps.encryption.decrypt(last)))) : DEFAULT_USER_SETTINGS;
      return cached;
    },
    async update(patch) {
      const current = await this.read();
      return persist({ ...current, ...patch, schemaVersion: USER_SETTINGS_SCHEMA_VERSION });
    },
    async reset() {
      return persist(DEFAULT_USER_SETTINGS);
    },
  };
}

export interface RuntimeConfigFromSettings {
  readonly pipeline: Partial<PipelineConfig>;
  readonly retention: Partial<RetentionPolicy>;
}

/** Pure: `UserSettings` -> the runtime's config shapes. */
export function mapSettingsToRuntimeConfig(settings: UserSettings): RuntimeConfigFromSettings {
  return {
    pipeline: {
      interventionsEnabled: settings.interventionsEnabled,
      context: { restPeriods: { windows: settings.restPeriods.map((w) => ({ startHour: w.startHour, endHour: w.endHour })) } },
    },
    retention: {
      rawEventsMs: settings.retentionDays.rawEvents * DAY,
      patternObservationsMs: settings.retentionDays.patternObservations * DAY,
      choicesMs: settings.retentionDays.choices * DAY,
      interventionRecordsMs: settings.retentionDays.interventionRecords * DAY,
      reflectionsMs: settings.retentionDays.reflections * DAY,
    },
  };
}
