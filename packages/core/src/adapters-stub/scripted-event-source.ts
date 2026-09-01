/**
 * EventSource stub — replays a scripted list of Events, in `occurredAt` order,
 * one batch per `pull()`. Stands in for the native Android/iOS adapters until
 * Implementation Step 1. It only ever surfaces observed facts (I-02).
 */

import type { Event } from '../contracts/event.contract.ts';
import type { EventSource } from '../pipeline/ports.ts';

export function createScriptedEventSource(script: readonly Event[]): EventSource & { remaining(): number } {
  const queue = [...script].sort((a, b) => a.occurredAt - b.occurredAt);
  return {
    async pull() {
      const batch = queue.splice(0, queue.length);
      return batch;
    },
    remaining() {
      return queue.length;
    },
  };
}

/** One-event-at-a-time variant, useful for step-by-step assertions in tests. */
export function createSteppedEventSource(script: readonly Event[]): EventSource & { remaining(): number } {
  const queue = [...script].sort((a, b) => a.occurredAt - b.occurredAt);
  return {
    async pull() {
      const next = queue.shift();
      return next ? [next] : [];
    },
    remaining() {
      return queue.length;
    },
  };
}
