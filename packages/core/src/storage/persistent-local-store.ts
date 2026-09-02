/**
 * `createPersistentLocalStore` — the full `LocalStore` on top of a byte
 * `StorageBackend` + an `EncryptionPort`. Local-first (I-09):
 *
 *  - every record is JSON, encrypted before it touches the backend, decrypted on
 *    read — the backend only ever holds ciphertext;
 *  - each log is lazily loaded once into memory and served from there;
 *  - `prune(now)` enforces retention: raw observation is dropped early, derived
 *    reflections are kept longest. Retention deletion is one-way and privacy-
 *    positive.
 */

import type { Event } from '../contracts/event.contract.ts';
import type { HumanChoice } from '../contracts/human-choice.contract.ts';
import type { ReflectionMirror } from '../contracts/reflection.contract.ts';
import type { PatternObservation } from '../engines/reflection-mirror.ts';
import type { InterventionRecord, LocalStore } from '../pipeline/ports.ts';
import type { Clock } from '../util/clock.ts';
import type { EncryptionPort, StorageBackend } from './ports.ts';

const LOG = {
  events: 'events',
  choices: 'choices',
  interventions: 'interventions',
  observations: 'pattern-observations',
  reflections: 'reflections',
} as const;

export interface RetentionPolicy {
  readonly rawEventsMs: number;
  readonly patternObservationsMs: number;
  readonly choicesMs: number;
  readonly interventionRecordsMs: number;
  readonly reflectionsMs: number;
}

const DAY = 24 * 60 * 60_000;

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = Object.freeze({
  rawEventsMs: 30 * DAY,
  patternObservationsMs: 180 * DAY,
  choicesMs: 30 * DAY,
  interventionRecordsMs: 14 * DAY,
  reflectionsMs: 365 * DAY,
});

export interface PruneSummary {
  readonly prunedAt: number;
  readonly removed: Readonly<Record<string, number>>;
}

export interface PersistentLocalStore extends LocalStore {
  /** Apply the retention policy. Safe to call on a schedule. */
  prune(nowMs?: number): Promise<PruneSummary>;
}

export function createPersistentLocalStore(deps: {
  readonly backend: StorageBackend;
  readonly encryption: EncryptionPort;
  readonly clock: Clock;
  readonly retention?: Partial<RetentionPolicy>;
}): PersistentLocalStore {
  const retention: RetentionPolicy = { ...DEFAULT_RETENTION_POLICY, ...deps.retention };
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const cache = new Map<string, unknown[]>();
  const loaded = new Set<string>();

  async function encode(item: unknown): Promise<Uint8Array> {
    return deps.encryption.encrypt(encoder.encode(JSON.stringify(item)));
  }

  async function load<T>(log: string, sortKey: (t: T) => number): Promise<T[]> {
    if (!loaded.has(log)) {
      const raw = await deps.backend.readAll(log);
      const items: T[] = [];
      for (const rec of raw) items.push(JSON.parse(decoder.decode(await deps.encryption.decrypt(rec))) as T);
      items.sort((a, b) => sortKey(a) - sortKey(b));
      cache.set(log, items);
      loaded.add(log);
    }
    return cache.get(log) as T[];
  }

  async function append<T>(log: string, item: T, sortKey: (t: T) => number): Promise<void> {
    const items = await load<T>(log, sortKey);
    items.push(item);
    items.sort((a, b) => sortKey(a) - sortKey(b));
    await deps.backend.append(log, await encode(item));
  }

  const between = <T,>(items: readonly T[], startMs: number, endMs: number, key: (t: T) => number): readonly T[] =>
    items.filter((it) => key(it) >= startMs && key(it) < endMs);

  const eventAt = (e: Event) => e.occurredAt;
  const choiceAt = (c: HumanChoice) => c.selectedAt;
  const recordAt = (r: InterventionRecord) => r.triggeredAt;
  const observationAt = (o: PatternObservation) => o.observedAt;
  const reflectionAt = (m: ReflectionMirror) => m.generatedAt;

  return {
    async appendEvent(event) {
      await append(LOG.events, event, eventAt);
    },
    async appendChoice(choice) {
      await append(LOG.choices, choice, choiceAt);
    },
    async appendInterventionRecord(record) {
      await append(LOG.interventions, record, recordAt);
    },
    async appendPatternObservation(observation) {
      await append(LOG.observations, observation, observationAt);
    },
    async saveReflection(mirror) {
      await append(LOG.reflections, mirror, reflectionAt);
    },

    async readEvents(startMs, endMs) {
      return between(await load<Event>(LOG.events, eventAt), startMs, endMs, eventAt);
    },
    async readChoices(startMs, endMs) {
      return between(await load<HumanChoice>(LOG.choices, choiceAt), startMs, endMs, choiceAt);
    },
    async readInterventionRecords(startMs, endMs) {
      return between(await load<InterventionRecord>(LOG.interventions, recordAt), startMs, endMs, recordAt);
    },
    async readPatternObservations(startMs, endMs) {
      return between(await load<PatternObservation>(LOG.observations, observationAt), startMs, endMs, observationAt);
    },

    async prune(nowMs = deps.clock.now()) {
      const specs: readonly [string, number, (x: never) => number][] = [
        [LOG.events, retention.rawEventsMs, eventAt as (x: never) => number],
        [LOG.observations, retention.patternObservationsMs, observationAt as (x: never) => number],
        [LOG.choices, retention.choicesMs, choiceAt as (x: never) => number],
        [LOG.interventions, retention.interventionRecordsMs, recordAt as (x: never) => number],
        [LOG.reflections, retention.reflectionsMs, reflectionAt as (x: never) => number],
      ];
      const removed: Record<string, number> = {};
      for (const [log, ageMs, key] of specs) {
        const items = await load<never>(log, key);
        const cutoff = nowMs - ageMs;
        const kept = items.filter((it) => key(it) >= cutoff);
        removed[log] = items.length - kept.length;
        if (removed[log] > 0) {
          cache.set(log, kept);
          const bytes: Uint8Array[] = [];
          for (const k of kept) bytes.push(await encode(k));
          await deps.backend.rewrite(log, bytes);
        }
      }
      return { prunedAt: nowMs, removed };
    },
  };
}
