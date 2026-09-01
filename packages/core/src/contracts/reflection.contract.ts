/**
 * CONTRACT 8 / 8 — REFLECTION MIRROR  (FROZEN — do not modify)
 *
 * Pipeline stage: [REFLECTION]
 * Data boundary : Layer 2 — Derived Structure, presented back to the human.
 *
 * A ReflectionMirror is exactly that: a mirror. It lists observable facts over a
 * time range and stops.
 *
 * Invariants enforced here:
 *  - I-07 Reflection, Not Judgment: NO health score, NO addiction index, NO
 *    streaks, NO "good day / bad day". `assertNoJudgment()` guards this at
 *    runtime.
 *  - I-06 No Dependency Replacement: the mirror is not a feed. It is generated on
 *    demand and contains nothing engineered to pull the user back.
 *  - I-10 No Hidden Manipulation: no variable rewards, no gamification.
 */

export const REFLECTION_SCHEMA_VERSION = '1.0.0' as const;

export interface ReflectionMirror {
  readonly id: string;
  readonly generatedAt: number;
  readonly timeRangeStart: number;
  readonly timeRangeEnd: number;
  readonly observableFacts: readonly {
    readonly patternName: string;
    readonly occurrenceCount: number;
    readonly contextSummary: string;
  }[];
  // NO JUDGMENT, NO HEALTH SCORES, NO ADDICTION INDEXES.
}
