# Human Agency OS — Master Prompt & Technical Specification

> This is the frozen source specification the scaffold is built from. Code must
> not deviate from the contracts or add psychological interpretation.

## 0. Product Purpose, Mission & Core Role

### 0.1 Core Mission

Free humans from the **Screen Matrix (Attention Economy)** and return **free,
conscious choice (Human Agency)** to every digital moment.

In an era manipulated by dopamine algorithms (short video, constant
notifications), this system does **not** exist to forbid, punish, or force a
digital detox. It exists to create an **Awareness Window** — turning automatic,
unconscious behaviour into deliberate decision.

### 0.2 Core Role & Positioning

- A **Human Agency Infrastructure** between the Human and the Digital Environment.
- Acts as a **"digital philosopher"**: silent at the right time, neutral in
  observation, minimal in intervention, absolute in its respect for human
  intention.
- It must **never** be:
  - ❌ a screen-time app that induces guilt;
  - ❌ a "psychological cop" that self-diagnoses the user as addicted or stressed;
  - ❌ a new attention magnet (must not replace a TikTok habit with an
    addiction to this app).

## 1. Product Constitution — 13 System Invariants

- **I-01 Agency Above Compliance** — optimize for conscious choice, not obedience.
- **I-02 Evidence Before Interpretation** — observe behaviour only; never infer
  internal mental/emotional state without explicit user confirmation.
- **I-03 Human Meaning Sovereignty** — only the human defines the meaning/intent
  of their experience.
- **I-04 Silence Is a Valid Action** — system silence is a first-class outcome,
  not an engine failure.
- **I-05 Minimum Necessary Intervention** — minimize frequency, duration,
  cognitive load, interruption intensity.
- **I-06 No Dependency Replacement** — never replace one digital dependency with a
  dependency on this app.
- **I-07 Reflection, Not Judgment** — make objective behavioural structure
  visible; never label the person or behaviour "good", "bad", "addicted",
  "compulsive".
- **I-08 Reversibility of Intervention** — every intervention is instantly
  dismissible, escapable, or reversible.
- **I-09 Local-First Data Sovereignty** — default processing is 100% on-device;
  the user has absolute control over sync.
- **I-10 No Hidden Manipulation** — no dark patterns, variable rewards, artificial
  urgency, shame, guilt, or fear.
- **I-11 Structural Naming Only** — names reflect objective structure, not
  presumed meaning (`ExtendedContinuousInteractionPattern`, never
  `DoomscrollingPattern`).
- **I-12 Non-Coercive Transparency** — do not disguise interventions as neutral
  observations; transparently state why an Awareness Window opened.
- **I-13 Choice Symmetry** — do not structurally, visually, or interactively
  privilege one valid choice over another (`[Continue]` and `[Exit]` have
  symmetrical weight).

## 2. Architecture & Data Flow

8-stage linear pipeline:

```
[EVENT] → [CONTEXT] → [PATTERN] → [INTERVENTION CANDIDATE] → [INTERVENTION POLICY]
        → [INTERVENTION] → [AWARENESS WINDOW & HUMAN CHOICE] → [REFLECTION]
```

Data boundary layers:

1. **Observation** — raw Events & Contexts.
2. **Derived Structure** — structural Patterns & metrics.
3. **Action** — minimal Interventions triggering Awareness Windows.
4. **Human Sovereignty** — Human Choice determines meaning & next state.

## 3. Strict Data Contracts (frozen)

The authoritative TypeScript lives in
[`packages/core/src/contracts/`](../packages/core/src/contracts). Every contract
declares `schemaVersion` `"1.0.0"`. Contracts are extended only via a new
`schemaVersion`, never by mutating a frozen interface.

1. `Event` — `ScreenStateChanged | ApplicationStateChanged | ExplicitInputReceived`.
2. `Context` — temporal frame + structural sequence metrics.
3. `Pattern` — `Repetition | RapidTransition | ExtendedDuration | TemporalDensity`,
   structural name, metrics, confidence, supporting event ids.
4. `InterventionCandidate` — pattern + context + `salienceScore` (structural only).
5. `InterventionPolicyDecision` — `Intervene | Silence`, reason, eligibility,
   interruption cost, fatigue index.
6. `Intervention` / `AwarenessWindow` — modality, transparent `payloadText`,
   2000–5000 ms hold.
7. `HumanChoice` — `Continue | Exit | ChangeContext | Postpone |
   ExplicitlyConfirmIntent | Dismiss`, optional `userSovereignNote`.
8. `ReflectionMirror` — `observableFacts` only. No judgment, no health score, no
   addiction index.

## 4. Intervention Engine Decision Logic

```
Eligibility   = PatternConfidence * PotentialValue * ContextRelevance
DecisionScore = Eligibility - InterruptionCost - InterventionFatigue

IF DecisionScore <= Threshold  OR  InterventionFatigue > MaxFatigueLimit
     → Silence   (Interaction Silence or Epistemic Silence)
IF DecisionScore > Threshold
     → Intervene → generate Intervention + open Awareness Window
```

Implemented in [`policy-engine.ts`](../packages/core/src/engines/policy-engine.ts).

## 5. UI/UX Guidelines — Choice Symmetry & Non-Coercive Transparency

1. **Zero dark patterns.** Primary and secondary actions (`[Continue]` vs
   `[Exit]`) have identical font size, button dimensions, background opacity, and
   animation speed. Never pre-focus or default-highlight `[Exit]`.
2. **Transparent messaging.** Never subjective/judgmental ("Are you sure?", "You
   are doomscrolling!"). Always objective ("Awareness Window: 30 minutes active
   on current application. Your choice: [Continue] [Exit]").
3. **The Return (context transition).** On exiting an extended session, trigger an
   optional "Return Moment": a dark screen with "You are here", one subtle haptic
   beat, auto-dismiss after 2 seconds. No celebratory animation, points, or
   gamified rewards.

## 6. Implementation Task Order

1. **Event Collector** — Android/iOS adapters output normalized `Event` objects.
2. **Context & Pattern Engine** — state-free pure functions deriving `Context`
   and detecting `Pattern` from `Event` streams.
3. **Intervention Policy Engine** — the mathematical decision function
   (`Intervene` vs `Silence`).
4. **Awareness Window & Choice Symmetry UI** — overlay/lock-screen with strictly
   symmetrical choice components.
5. **Reflection Mirror** — local-first storage and non-judgmental facts mirror UI.

> Do not deviate from these contracts or add psychological interpretations to the
> system. Build exactly according to this specification.
