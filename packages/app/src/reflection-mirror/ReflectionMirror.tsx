/**
 * STUB — Step 5 wires this to React Native.
 *
 * Rendering rules:
 *  - I-07 Reflection, Not Judgment: render `row.patternName`, `row.occurrenceCount`,
 *    `row.contextSummary` as plain text rows. No progress bars, no red/green, no
 *    "you improved", no ranking. A large count is not styled differently from a
 *    small one.
 *  - I-06 No Dependency Replacement: this screen is opened deliberately by the
 *    user. No badge on the app icon, no daily push telling them to come look.
 *  - Empty range shows `vm.emptyText`, calmly. That is a complete state.
 */

import type { ReflectionMirrorViewModel } from './reflection-mirror.viewmodel.ts';

export interface ReflectionMirrorProps {
  readonly vm: ReflectionMirrorViewModel;
}

export function ReflectionMirror(_props: ReflectionMirrorProps): unknown {
  throw new Error('ReflectionMirror: React Native implementation lands in Step 5. Use toReflectionMirrorViewModel.');
}
