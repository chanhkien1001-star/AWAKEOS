/**
 * `createLocalBaselineProvider` — feeds `PipelineDeps.getBaseline`.
 *
 * Reads the trailing event window from the local store (I-09: on-device only),
 * segments it into sessions and summarises them into a `BehavioralBaseline`. The
 * result is cached and only recomputed once every `recomputeEveryMs`, so a busy
 * `tick()` loop doesn't re-summarise 30 days of events every event batch.
 *
 * Everything it touches is structural (I-02); it never labels a session.
 */

import {
  buildBaselineFromEvents,
  emptyBaseline,
  type BehavioralBaseline,
  type Clock,
  type LocalStore,
  type SessionSegmenterConfig,
} from '@awake-os/core';

export interface LocalBaselineProviderOptions {
  readonly store: LocalStore;
  readonly clock: Clock;
  /** Trailing window summarised into the baseline. Default 30. */
  readonly coverageDays?: number;
  /** Minimum time between recomputes. Default 6h. */
  readonly recomputeEveryMs?: number;
  readonly segmenter?: SessionSegmenterConfig;
}

export interface LocalBaselineProvider {
  /** Pass as `PipelineDeps.getBaseline`. */
  getBaseline(): Promise<BehavioralBaseline>;
  /** Force a recompute on the next call. */
  invalidate(): void;
}

export function createLocalBaselineProvider(opts: LocalBaselineProviderOptions): LocalBaselineProvider {
  const coverageDays = opts.coverageDays ?? 30;
  const recomputeEveryMs = opts.recomputeEveryMs ?? 6 * 60 * 60_000;

  let cached: BehavioralBaseline | null = null;
  let computedAt = -Infinity;

  return {
    async getBaseline() {
      const now = opts.clock.now();
      if (cached && now - computedAt < recomputeEveryMs) return cached;

      const windowStart = now - coverageDays * 24 * 60 * 60_000;
      let events;
      try {
        events = await opts.store.readEvents(windowStart, now + 1);
      } catch {
        return cached ?? emptyBaseline(now, coverageDays);
      }

      const baselineOpts = opts.segmenter === undefined
        ? { now, coverageDays }
        : { now, coverageDays, segmenter: opts.segmenter };
      cached = buildBaselineFromEvents(events, baselineOpts);
      computedAt = now;
      return cached;
    },

    invalidate() {
      cached = null;
      computedAt = -Infinity;
    },
  };
}
