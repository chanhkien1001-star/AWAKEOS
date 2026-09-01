/**
 * CONTRACT 4 / 8 — INTERVENTION CANDIDATE  (FROZEN — do not modify)
 *
 * Pipeline stage: [INTERVENTION CANDIDATE]
 * Data boundary : Layer 2 — Derived Structure.
 *
 * A candidate says only "a structure salient enough to *consider* acting on
 * exists here". Whether anything actually happens is decided later by the
 * Intervention Policy Engine, whose default answer is Silence (I-04).
 * `salienceScore` is computed purely from structural metrics — never from any
 * inferred psychological state (I-02).
 */

export const INTERVENTION_CANDIDATE_SCHEMA_VERSION = '1.0.0' as const;

export interface InterventionCandidate {
  readonly id: string;
  readonly generatedAt: number;
  readonly patternId: string;
  readonly contextId: string;
  readonly salienceScore: number; // Based purely on structural metrics
  readonly schemaVersion: string;
}
