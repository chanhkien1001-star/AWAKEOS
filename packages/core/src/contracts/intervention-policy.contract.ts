/**
 * CONTRACT 5 / 8 — INTERVENTION POLICY DECISION  (FROZEN — do not modify)
 *
 * Pipeline stage: [INTERVENTION POLICY]
 * Data boundary : Layer 3 — Action gate.
 *
 * Invariants enforced here:
 *  - I-04 Silence Is a Valid Action: `decision: 'Silence'` is a first-class,
 *    successful outcome. It is logged, never treated as an engine failure.
 *  - I-05 Minimum Necessary Intervention: the maths subtracts `interruptionCost`
 *    and `fatigueIndex`, so the bar to interrupt a human rises the more the
 *    system has already spoken.
 *  - I-01 Agency Above Compliance: the decision optimises for a well-placed
 *    Awareness Window, not for maximising interventions.
 */

export const INTERVENTION_POLICY_SCHEMA_VERSION = '1.0.0' as const;

export type PolicyDecisionType = 'Intervene' | 'Silence';

export interface InterventionPolicyDecision {
  readonly candidateId: string;
  readonly decision: PolicyDecisionType;
  readonly decisionReason:
    | 'EpistemicUncertainty'
    | 'InterventionFatigue'
    | 'HighSalienceThresholdMet';
  readonly calculatedEligibility: number;
  readonly interruptionCost: number;
  readonly fatigueIndex: number;
}
