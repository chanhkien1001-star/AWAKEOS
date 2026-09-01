/**
 * Id generation as an injectable port so the pipeline stays deterministic under
 * test. Production uses `cryptoIdFactory` (UUIDv4 per the Event contract).
 */

export interface IdFactory {
  /** RFC 4122 UUIDv4 string. */
  uuid(): string;
}

export const cryptoIdFactory: IdFactory = {
  uuid: () => globalThis.crypto.randomUUID(),
};

/** Deterministic, monotonic ids for tests: `seed-1`, `seed-2`, ... */
export function sequentialIdFactory(seed = 'id'): IdFactory {
  let n = 0;
  return { uuid: () => `${seed}-${++n}` };
}
