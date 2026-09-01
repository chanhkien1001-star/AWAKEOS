/**
 * STAGE 1 — [EVENT] · ingestion surface.
 *
 * Platform adapters produce `RawNativeEvent`s; `createEventCollector` normalizes,
 * de-bounces, orders and buffers them behind the `EventSource` port that the
 * pipeline pulls from.
 */

export * from './raw-event.ts';
export * from './event-normalizer.ts';
export * from './event-collector.ts';
