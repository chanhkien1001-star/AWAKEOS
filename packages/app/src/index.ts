/**
 * @awake-os/app — shell / UI layer public surface.
 *
 * Framework-agnostic controllers, view-models and render descriptors. The React
 * Native components (*.tsx) are thin translations of these and are wired up
 * inside a host app (they are excluded from this package's type-check).
 */

export * from './ingestion/index.ts';
export * from './baseline/local-baseline-provider.ts';

// Stage 6/7 — Awareness Window & Choice Symmetry
export * from './awareness-window/choice-symmetry.ts';
export * from './awareness-window/awareness-window.viewmodel.ts';
export * from './awareness-window/awareness-window-controller.ts';
export * from './awareness-window/awareness-window-render.ts';
export * from './awareness-window/choice-provider-adapter.ts';

// Stage 8 — Reflection Mirror
export * from './reflection-mirror/reflection-mirror.viewmodel.ts';
export * from './reflection-mirror/reflection-mirror-render.ts';
export * from './reflection-mirror/reflection-range.ts';

// Local-first storage adapters
export * from './storage/index.ts';

export * from './return-moment/return-moment.ts';
