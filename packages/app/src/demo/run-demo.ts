/**
 * A self-contained end-to-end run of the whole engine against a synthetic day
 * of phone usage. No device, no RN — just the pure core + the in-memory /
 * xor-encrypted storage stubs.
 *
 *   `npm run demo`            — prints a narrated run
 *   imported as `runDemo()`   — used by the CI smoke test
 */

import {
  createEventCollector,
  createInMemoryStorageBackend,
  RawNativeEvents,
  xorEncryption,
  type Event,
  type PipelineOutcome,
  type RawNativeEvent,
  type ReflectionMirror,
} from '@awake-os/core';
import { createAwakeRuntime } from '../runtime/awake-runtime.ts';
import { createConsoleChoiceProvider } from './console-choice-provider.ts';

const DAY = 24 * 60 * 60_000;
const HASH = 'sha256:demo0011_2233-4455667788990011223344556677889900';

function mutableClock(start: number) {
  let t = start;
  return { now: () => t, set: (v: number) => (t = v), advance: (ms: number) => (t += ms) };
}

function rawToEvent(raw: RawNativeEvent, id: string): Event {
  return {
    id,
    occurredAt: raw.occurredAt,
    type: raw.type as Event['type'],
    source: { type: (raw.sourceType as 'System' | 'User') ?? 'System', id: raw.sourceId ?? 'demo' },
    subject:
      raw.subjectId != null
        ? { type: 'Application', id: raw.subjectId }
        : { type: (raw.subjectType as 'Screen' | 'UserInput') ?? 'Screen' },
    payload: raw.payload as Event['payload'],
    schemaVersion: '1.0.0',
  };
}

/** ~14 evenings of ~12-minute sessions, so the personal baseline is mature. */
function priorHistory(now: number): Event[] {
  const out: Event[] = [];
  for (let d = 1; d <= 14; d++) {
    const start = now - d * DAY;
    const minutes = 10 + (d % 5);
    out.push(rawToEvent(RawNativeEvents.screen('Unlocked', start), `h-${d}-u`));
    out.push(rawToEvent(RawNativeEvents.application('Foreground', HASH, start + 1_000), `h-${d}-f`));
    for (let k = 1; k <= 12; k++) {
      out.push(rawToEvent(RawNativeEvents.explicitInput('scroll', Math.round(start + (k * minutes * 60_000) / 12)), `h-${d}-${k}`));
    }
    out.push(rawToEvent(RawNativeEvents.screen('Locked', start + minutes * 60_000 + 5_000), `h-${d}-l`));
  }
  return out;
}

/** Tonight: a 45-minute single-app session, then a burst of app-switching. */
function tonight(start: number): RawNativeEvent[] {
  const raws: RawNativeEvent[] = [
    RawNativeEvents.screen('Unlocked', start),
    RawNativeEvents.application('Foreground', HASH, start + 1_000),
  ];
  for (let k = 1; k <= 60; k++) raws.push(RawNativeEvents.explicitInput('scroll', Math.round(start + (k * 45 * 60_000) / 60)));
  const switchStart = start + 45 * 60_000 + 2_000;
  for (let k = 0; k < 12; k++) {
    raws.push(
      RawNativeEvents.application('Foreground', `sha256:app${k % 3}______________________________________`, switchStart + k * 2_500),
    );
  }
  raws.push(RawNativeEvents.screen('Locked', switchStart + 40_000));
  return raws;
}

export interface DemoResult {
  readonly events: number;
  readonly outcomes: readonly PipelineOutcome[];
  readonly interventions: number;
  readonly silences: number;
  readonly mirror: ReflectionMirror;
}

export async function runDemo(opts: { log?: (line: string) => void } = {}): Promise<DemoResult> {
  const log = opts.log ?? (() => {});
  const startOfDay = Date.UTC(2026, 4, 12, 0, 0, 0);
  const sessionStart = startOfDay + 21 * 60 * 60_000; // 21:00
  const clock = mutableClock(sessionStart + 47 * 60_000);
  const ids = (() => {
    let n = 0;
    return { uuid: () => `d-${++n}` };
  })();

  const collector = createEventCollector({ ids, clock });

  const runtime = createAwakeRuntime({
    eventSource: collector,
    choiceProvider: createConsoleChoiceProvider({
      ids,
      clock,
      script: ['Continue', 'Continue', 'Exit', 'ChangeContext', 'Dismiss'],
      log,
    }),
    storageBackend: createInMemoryStorageBackend(),
    encryption: xorEncryption(0x2b),
    clock,
    ids,
    telemetry: {
      stage: (() => {
        let last = '';
        return (name: string, detail: Record<string, unknown>) => {
          if (name !== 'policy') return;
          const key = `${String(detail['decision'])}/${String(detail['reason'])}`;
          if (key === last) return; // collapse runs of the same policy outcome
          last = key;
          log(`    · policy → ${key}  (score ${Number(detail['decisionScore']).toFixed(3)}, fatigue ${Number(detail['fatigueIndex']).toFixed(3)})`);
        };
      })(),
    },
  });

  // seed the prior history so the baseline is mature
  for (const e of priorHistory(sessionStart)) await runtime.store.appendEvent(e);
  runtime.invalidateBaseline();

  // feed tonight's raw signals into the collector (the pipeline's EventSource)
  const events = tonight(sessionStart);
  collector.ingestRaw(events);

  log('AWAKE OS — synthetic evening run');
  log('================================');
  log(`ingested ${events.length} raw signals for tonight (21:00-22:00)\n`);

  const outcomes = await runtime.tick();

  const kinds = new Map<string, number>();
  for (const o of outcomes) kinds.set(o.kind, (kinds.get(o.kind) ?? 0) + 1);
  const interventions = kinds.get('Choice') ?? 0;
  const silences = kinds.get('Silence') ?? 0;

  log('\noutcome breakdown:');
  for (const [k, v] of kinds) log(`  ${k.padEnd(12)} ${v}`);

  const silenceReasons = new Map<string, number>();
  for (const o of outcomes) {
    if (o.kind === 'Silence') {
      silenceReasons.set(o.decision.decisionReason, (silenceReasons.get(o.decision.decisionReason) ?? 0) + 1);
    }
  }
  if (silenceReasons.size) {
    log('\nsilence reasons:');
    for (const [r, v] of silenceReasons) log(`  ${r.padEnd(24)} ${v}`);
  }

  const mirror = await runtime.reflect(startOfDay, clock.now());
  log('\nReflection Mirror (today):');
  if (mirror.observableFacts.length === 0) log('  (nothing recorded)');
  for (const f of mirror.observableFacts) {
    log(`  • ${f.patternName} - ${f.occurrenceCount}x`);
    log(`      ${f.contextSummary}`);
  }

  const pruned = await runtime.prune();
  log(`\nretention prune: ${JSON.stringify(pruned.removed)}`);

  return { events: events.length, outcomes, interventions, silences, mirror };
}
