/**
 * @awake-os/core — public surface.
 *
 * Pure TypeScript. No platform SDK, no UI toolkit, no database. The outside world
 * plugs in through the ports in `./pipeline/ports.ts`.
 */

// 8 FROZEN data contracts
export * from './contracts/index.ts';

// Product Constitution — 13 invariants + runtime guards
export * from './invariants/invariants.ts';

// Ports (seams to platform adapters / UI / storage)
export * from './pipeline/ports.ts';

// Stage 1 — [EVENT] ingestion: normalize + de-bounce raw native signals
export * from './ingestion/index.ts';

// Pipeline stages (pure functions)
export * from './engines/context-builder.ts';
export * from './engines/pattern-detector.ts';
export * from './engines/candidate-generator.ts';
export * from './engines/policy-engine.ts';
export * from './engines/intervention-factory.ts';
export * from './engines/reflection-mirror.ts';

// End-to-end orchestrator
export * from './pipeline/pipeline.ts';

// Injectable utilities
export * from './util/clock.ts';
export * from './util/id.ts';

// Stub adapters (replace in Steps 1-5; handy for tests and demos)
export { createMemoryStore } from './adapters-stub/memory-store.ts';
export { createScriptedEventSource, createSteppedEventSource } from './adapters-stub/scripted-event-source.ts';
export { createScriptedChoiceProvider, type ScriptedChoice } from './adapters-stub/scripted-choice-provider.ts';
