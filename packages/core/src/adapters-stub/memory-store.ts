/**
 * In-memory LocalStore — the reference implementation of I-09 Local-First:
 * nothing leaves the process. Real device builds swap this for encrypted
 * on-device storage; a sync adapter, if it ever exists, is separate and opt-in.
 *
 * Used by tests and by the scaffold end-to-end run.
 */

import type { Event } from '../contracts/event.contract.ts';
import type { HumanChoice } from '../contracts/human-choice.contract.ts';
import type { ReflectionMirror } from '../contracts/reflection.contract.ts';
import type { InterventionRecord, LocalStore } from '../pipeline/ports.ts';

export function createMemoryStore(): LocalStore & {
  readonly _events: readonly Event[];
  readonly _choices: readonly HumanChoice[];
  readonly _interventions: readonly InterventionRecord[];
  readonly _reflections: readonly ReflectionMirror[];
} {
  const events: Event[] = [];
  const choices: HumanChoice[] = [];
  const interventions: InterventionRecord[] = [];
  const reflections: ReflectionMirror[] = [];

  return {
    async appendEvent(event) {
      events.push(event);
      events.sort((a, b) => a.occurredAt - b.occurredAt);
    },
    async appendChoice(choice) {
      choices.push(choice);
    },
    async appendInterventionRecord(record) {
      interventions.push(record);
      interventions.sort((a, b) => a.triggeredAt - b.triggeredAt);
    },
    async saveReflection(mirror) {
      reflections.push(mirror);
    },
    async readEvents(startMs, endMs) {
      return events.filter((e) => e.occurredAt >= startMs && e.occurredAt < endMs);
    },
    async readChoices(startMs, endMs) {
      return choices.filter((c) => c.selectedAt >= startMs && c.selectedAt < endMs);
    },
    async readInterventionRecords(startMs, endMs) {
      return interventions.filter((r) => r.triggeredAt >= startMs && r.triggeredAt < endMs);
    },
    get _events() {
      return events;
    },
    get _choices() {
      return choices;
    },
    get _interventions() {
      return interventions;
    },
    get _reflections() {
      return reflections;
    },
  };
}
