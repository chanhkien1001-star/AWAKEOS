/**
 * Time as an injectable port. All pipeline timestamps (`occurredAt`,
 * `detectedAt`, `triggeredAt`, ...) come from a Clock so runs are reproducible.
 */

export interface Clock {
  /** Unix epoch UTC milliseconds. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** A clock the test can advance by hand. */
export function fixedClock(startMs: number): Clock & { advance(ms: number): void; set(ms: number): void } {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    set: (ms: number) => {
      t = ms;
    },
  };
}
