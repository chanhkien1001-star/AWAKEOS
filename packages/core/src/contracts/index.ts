/**
 * The 8 FROZEN data contracts of Human Agency OS, in pipeline order:
 *
 *   1. Event                     — [EVENT]                  Observation
 *   2. Context                   — [CONTEXT]                Observation
 *   3. Pattern                   — [PATTERN]                Derived Structure
 *   4. InterventionCandidate     — [INTERVENTION CANDIDATE] Derived Structure
 *   5. InterventionPolicyDecision— [INTERVENTION POLICY]    Action gate
 *   6. Intervention / AwarenessWindow — [INTERVENTION] / [AWARENESS WINDOW]  Action
 *   7. HumanChoice               — [HUMAN CHOICE]           Human Sovereignty
 *   8. ReflectionMirror          — [REFLECTION]             Mirror
 *
 * Do not edit the shapes. Extensions happen via new schemaVersion, never by
 * mutating a frozen interface.
 */

export * from './event.contract.ts';
export * from './context.contract.ts';
export * from './pattern.contract.ts';
export * from './intervention-candidate.contract.ts';
export * from './intervention-policy.contract.ts';
export * from './intervention.contract.ts';
export * from './human-choice.contract.ts';
export * from './reflection.contract.ts';
