/**
 * STAGE 1 — [EVENT] · normalization & validation.
 *
 * `normalizeEvent` is a pure function: (RawNativeEvent, deps) -> a contract-valid
 * frozen `Event`, or a typed rejection. It is the single trust boundary between
 * the platform and the pipeline.
 *
 * It enforces, in code:
 *  - the frozen Event contract shape + `schemaVersion` "1.0.0";
 *  - I-02 Evidence Before Interpretation: payloads are allow-listed per event
 *    type; any extra field (a window title, a URL, free text) is rejected;
 *  - I-09 Local-First Data Sovereignty: application identifiers must already be
 *    salted hashes — a raw package / bundle id is rejected;
 *  - plausible timestamps (not zero, not pre-2020, not far in the future).
 */

import type { Event, EventType } from '../contracts/event.contract.ts';
import { EVENT_SCHEMA_VERSION } from '../contracts/event.contract.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';
import type { RawNativeEvent } from './raw-event.ts';

export type NormalizeRejectionReason =
  | 'UnknownEventType'
  | 'InvalidTimestamp'
  | 'MalformedPayload'
  | 'DisallowedPayloadField'
  | 'UnhashedIdentifier'
  | 'InvalidEnumValue'
  | 'SchemaVersionMismatch';

export type NormalizeResult =
  | { readonly ok: true; readonly event: Event; readonly idRegenerated: boolean }
  | { readonly ok: false; readonly reason: NormalizeRejectionReason; readonly detail: string };

export interface NormalizeConfig {
  /** How far past `clock.now()` a native timestamp may sit (clock skew). Default 120_000. */
  readonly futureToleranceMs?: number;
  /** Earliest plausible epoch ms. Default 2020-01-01T00:00:00Z. */
  readonly minEpochMs?: number;
}

const EVENT_TYPES: readonly EventType[] = ['ScreenStateChanged', 'ApplicationStateChanged', 'ExplicitInputReceived'];
const SOURCE_TYPES = ['System', 'User'] as const;
const SUBJECT_TYPES = ['Device', 'Screen', 'Application', 'UserInput'] as const;

const SCREEN_STATES = ['On', 'Off', 'Unlocked', 'Locked'] as const;
const APP_STATES = ['Foreground', 'Background', 'Terminated'] as const;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** salted hash, e.g. "sha256:<base64url>" — no dots, no raw package ids. */
const HASHED_ID = /^(sha256|sha512|blake3):[A-Za-z0-9_-]{16,}$/;
const LOOKS_LIKE_PACKAGE_ID = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
/** action ids are enum-like identifiers, never free text (keeps PII out — I-02). */
const ACTION_ID = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;

const DEFAULT_MIN_EPOCH_MS = Date.UTC(2020, 0, 1);
const DEFAULT_FUTURE_TOLERANCE_MS = 120_000;

function reject(reason: NormalizeRejectionReason, detail: string): NormalizeResult {
  return { ok: false, reason, detail };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

function normalizePayload(
  type: EventType,
  payload: Readonly<Record<string, unknown>>,
): { ok: true; value: Event['payload'] } | { ok: false; result: NormalizeResult } {
  const keys = Object.keys(payload);

  if (type === 'ScreenStateChanged') {
    if (keys.length !== 1 || keys[0] !== 'state') {
      return { ok: false, result: reject('DisallowedPayloadField', `ScreenStateChanged payload keys: [${keys.join(', ')}]`) };
    }
    if (!(SCREEN_STATES as readonly unknown[]).includes(payload['state'])) {
      return { ok: false, result: reject('InvalidEnumValue', `screen state: ${JSON.stringify(payload['state'])}`) };
    }
    return { ok: true, value: { state: payload['state'] as (typeof SCREEN_STATES)[number] } };
  }

  if (type === 'ApplicationStateChanged') {
    const extra = keys.filter((k) => k !== 'state' && k !== 'packageNameHash');
    if (extra.length > 0) {
      return { ok: false, result: reject('DisallowedPayloadField', `ApplicationStateChanged extra keys: [${extra.join(', ')}]`) };
    }
    if (!(APP_STATES as readonly unknown[]).includes(payload['state'])) {
      return { ok: false, result: reject('InvalidEnumValue', `application state: ${JSON.stringify(payload['state'])}`) };
    }
    const hash = payload['packageNameHash'];
    if (typeof hash !== 'string' || !HASHED_ID.test(hash) || LOOKS_LIKE_PACKAGE_ID.test(hash)) {
      return {
        ok: false,
        result: reject('UnhashedIdentifier', `packageNameHash must be a salted hash, got ${JSON.stringify(hash)}`),
      };
    }
    return { ok: true, value: { state: payload['state'] as (typeof APP_STATES)[number], packageNameHash: hash } };
  }

  // ExplicitInputReceived
  const extra = keys.filter((k) => k !== 'actionId' && k !== 'value');
  if (extra.length > 0) {
    return { ok: false, result: reject('DisallowedPayloadField', `ExplicitInputReceived extra keys: [${extra.join(', ')}]`) };
  }
  const actionId = payload['actionId'];
  if (typeof actionId !== 'string' || !ACTION_ID.test(actionId)) {
    return { ok: false, result: reject('MalformedPayload', `actionId must be an identifier, got ${JSON.stringify(actionId)}`) };
  }
  if ('value' in payload) {
    const v = payload['value'];
    const t = typeof v;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') {
      return { ok: false, result: reject('MalformedPayload', `input value must be a primitive, got ${t}`) };
    }
    if (t === 'string' && (/[\n\r\t]/.test(v as string) || (v as string).length > 128)) {
      return { ok: false, result: reject('DisallowedPayloadField', 'input string value looks like free text (newline or > 128 chars)') };
    }
    return { ok: true, value: { actionId, value: v as string | number | boolean } };
  }
  return { ok: true, value: { actionId } };
}

export function normalizeEvent(
  raw: RawNativeEvent,
  deps: { readonly ids: IdFactory; readonly clock: Clock },
  config: NormalizeConfig = {},
): NormalizeResult {
  const minEpoch = config.minEpochMs ?? DEFAULT_MIN_EPOCH_MS;
  const futureTolerance = config.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS;

  if (!EVENT_TYPES.includes(raw.type as EventType)) {
    return reject('UnknownEventType', JSON.stringify(raw.type));
  }
  const type = raw.type as EventType;

  if (raw.schemaVersion != null && raw.schemaVersion !== EVENT_SCHEMA_VERSION) {
    return reject('SchemaVersionMismatch', `expected ${EVENT_SCHEMA_VERSION}, got ${raw.schemaVersion}`);
  }

  const at = raw.occurredAt;
  if (typeof at !== 'number' || !Number.isFinite(at) || !Number.isInteger(at) || at < minEpoch || at > deps.clock.now() + futureTolerance) {
    return reject('InvalidTimestamp', `occurredAt=${at}`);
  }

  if (raw.payload == null || typeof raw.payload !== 'object') {
    return reject('MalformedPayload', 'payload missing');
  }
  const payloadResult = normalizePayload(type, raw.payload);
  if (!payloadResult.ok) return payloadResult.result;

  const sourceType = raw.sourceType ?? (type === 'ExplicitInputReceived' ? 'User' : 'System');
  if (!(SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    return reject('InvalidEnumValue', `source.type: ${JSON.stringify(sourceType)}`);
  }
  const defaultSubject =
    type === 'ScreenStateChanged' ? 'Screen' : type === 'ApplicationStateChanged' ? 'Application' : 'UserInput';
  const subjectType = raw.subjectType ?? defaultSubject;
  if (!(SUBJECT_TYPES as readonly string[]).includes(subjectType)) {
    return reject('InvalidEnumValue', `subject.type: ${JSON.stringify(subjectType)}`);
  }

  const idRegenerated = typeof raw.id !== 'string' || !UUID_V4.test(raw.id);
  const id = idRegenerated ? deps.ids.uuid() : (raw.id as string);

  const event: Event = {
    id,
    occurredAt: at,
    type,
    source: { type: sourceType as (typeof SOURCE_TYPES)[number], id: raw.sourceId ?? 'unknown' },
    subject:
      raw.subjectId != null
        ? { type: subjectType as (typeof SUBJECT_TYPES)[number], id: raw.subjectId }
        : { type: subjectType as (typeof SUBJECT_TYPES)[number] },
    payload: payloadResult.value,
    schemaVersion: EVENT_SCHEMA_VERSION,
  };

  return { ok: true, event: deepFreeze(event), idRegenerated };
}
