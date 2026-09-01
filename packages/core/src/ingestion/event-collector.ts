/**
 * STAGE 1 — [EVENT] · the collector.
 *
 * `createEventCollector` is the production implementation of the `EventSource`
 * port. Platform adapters (or the app's own UI, for explicit inputs) push
 * `RawNativeEvent`s in; the pipeline pulls contract-valid `Event`s out.
 *
 * Responsibilities beyond normalization:
 *  - de-bounce OS chatter: identical (type, subject, state) signals inside a
 *    short window collapse to one (I-05 — don't let a bouncing screen sensor turn
 *    into a storm of interventions);
 *  - deterministic ordering: `pull()` drains oldest-first by `occurredAt`;
 *  - bounded memory: an overflowing buffer drops its OLDEST entries (never the
 *    newest) and reports it via telemetry;
 *  - every rejection and drop is counted and traced — nothing fails silently.
 *
 * It holds only this small amount of state; it does not interpret anything.
 */

import type { Event } from '../contracts/event.contract.ts';
import type { EventSource, PipelineTelemetry } from '../pipeline/ports.ts';
import { noopTelemetry } from '../pipeline/ports.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';
import { normalizeEvent, type NormalizeConfig, type NormalizeRejectionReason } from './event-normalizer.ts';
import { RawNativeEvents, type RawNativeEvent } from './raw-event.ts';

export interface EventCollectorConfig {
  /** Same-signature signals within this window collapse to one. Default 400ms. */
  readonly dedupWindowMs: number;
  /** Max buffered events before oldest are dropped. Default 5000. */
  readonly maxBufferSize: number;
  readonly normalize: NormalizeConfig;
}

export const DEFAULT_EVENT_COLLECTOR_CONFIG: EventCollectorConfig = Object.freeze({
  dedupWindowMs: 400,
  maxBufferSize: 5_000,
  normalize: {},
});

export interface IngestSummary {
  readonly received: number;
  readonly accepted: number;
  readonly deduped: number;
  readonly rejected: number;
  readonly rejections: Readonly<Partial<Record<NormalizeRejectionReason, number>>>;
}

export interface EventCollector extends EventSource {
  /** Called by a platform adapter with one raw signal or a batch. */
  ingestRaw(raw: RawNativeEvent | readonly RawNativeEvent[]): IngestSummary;
  /** Called by the app's own UI when the user performs a shared, explicit action. */
  recordExplicitInput(actionId: string, value?: string | number | boolean): IngestSummary;
  /** Events buffered but not yet pulled. */
  pendingCount(): number;
}

interface Deps {
  readonly ids: IdFactory;
  readonly clock: Clock;
  readonly telemetry?: PipelineTelemetry;
  readonly config?: Partial<EventCollectorConfig>;
}

function signatureOf(e: Event): string {
  const state = 'state' in e.payload ? e.payload.state : 'actionId' in e.payload ? e.payload.actionId : '';
  return `${e.type}|${e.subject.id ?? e.subject.type}|${state}`;
}

export function createEventCollector(deps: Deps): EventCollector {
  const cfg: EventCollectorConfig = {
    ...DEFAULT_EVENT_COLLECTOR_CONFIG,
    ...deps.config,
    normalize: { ...DEFAULT_EVENT_COLLECTOR_CONFIG.normalize, ...deps.config?.normalize },
  };
  const tel = deps.telemetry ?? noopTelemetry;

  let buffer: Event[] = [];
  /** Signatures of recently seen events, for de-bounce across pulls. */
  const recent: { sig: string; at: number }[] = [];

  function pruneRecent(nowRef: number): void {
    const cutoff = nowRef - cfg.dedupWindowMs;
    while (recent.length > 0 && recent[0]!.at < cutoff) recent.shift();
  }

  function ingestMany(raws: readonly RawNativeEvent[]): IngestSummary {
    let accepted = 0;
    let deduped = 0;
    let rejected = 0;
    const rejections: Partial<Record<NormalizeRejectionReason, number>> = {};

    for (const raw of raws) {
      const res = normalizeEvent(raw, { ids: deps.ids, clock: deps.clock }, cfg.normalize);
      if (!res.ok) {
        rejected += 1;
        rejections[res.reason] = (rejections[res.reason] ?? 0) + 1;
        tel.stage('ingestion.rejected', { reason: res.reason, detail: res.detail });
        continue;
      }
      const { event } = res;
      const sig = signatureOf(event);
      pruneRecent(event.occurredAt);
      const isDup = recent.some((r) => r.sig === sig && Math.abs(event.occurredAt - r.at) <= cfg.dedupWindowMs);
      if (isDup) {
        deduped += 1;
        tel.stage('ingestion.deduped', { signature: sig, occurredAt: event.occurredAt });
        continue;
      }
      recent.push({ sig, at: event.occurredAt });
      buffer.push(event);
      accepted += 1;
    }

    if (buffer.length > cfg.maxBufferSize) {
      const overflow = buffer.length - cfg.maxBufferSize;
      buffer.sort((a, b) => a.occurredAt - b.occurredAt);
      buffer = buffer.slice(overflow);
      tel.stage('ingestion.overflow', { dropped: overflow, kept: buffer.length });
    }

    return { received: raws.length, accepted, deduped, rejected, rejections };
  }

  return {
    ingestRaw(raw) {
      return ingestMany(Array.isArray(raw) ? raw : [raw as RawNativeEvent]);
    },

    recordExplicitInput(actionId, value) {
      return ingestMany([RawNativeEvents.explicitInput(actionId, deps.clock.now(), value)]);
    },

    pendingCount() {
      return buffer.length;
    },

    async pull() {
      if (buffer.length === 0) return [];
      buffer.sort((a, b) => a.occurredAt - b.occurredAt);
      const drained = buffer;
      buffer = [];
      tel.stage('ingestion.pull', { count: drained.length });
      return drained;
    },
  };
}
