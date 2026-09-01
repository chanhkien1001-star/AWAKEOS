# Architecture — Human Agency OS

## Purpose (the line every contributor defends)

> Free people from the attention economy by returning conscious choice to each
> digital moment.

Human Agency OS is a **Human Agency Infrastructure** that sits between a person
and their digital environment. It opens a brief **Awareness Window** so an
automatic behaviour can become a deliberate decision. It is **not** a screen-time
app, **not** a psychological cop, and **not** a new thing to be hooked on.

Success = the person chose consciously — including when they choose to continue.

## The 8-stage pipeline

```
[EVENT] → [CONTEXT] → [PATTERN] → [INTERVENTION CANDIDATE]
        → [INTERVENTION POLICY] → [INTERVENTION]
        → [AWARENESS WINDOW & HUMAN CHOICE] → [REFLECTION]
```

| # | Stage | Module | Kind | Data-boundary layer |
|---|-------|--------|------|---------------------|
| 1 | EVENT | `adapters/*` (native) → `core/ingestion/*` (`normalizeEvent` + `createEventCollector`) → `EventSource` port | native + pure TS trust boundary | 1 · Observation |
| 2 | CONTEXT | `core/engines/context-builder.ts` | pure, state-free | 1 · Observation |
| 3 | PATTERN | `core/engines/pattern-detector.ts` *(stub logic)* | pure, state-free | 2 · Derived Structure |
| 4 | INTERVENTION CANDIDATE | `core/engines/candidate-generator.ts` *(stub logic)* | pure | 2 · Derived Structure |
| 5 | INTERVENTION POLICY | `core/engines/policy-engine.ts` **(real maths)** | pure | 3 · Action gate |
| 6 | INTERVENTION + AWARENESS WINDOW | `core/engines/intervention-factory.ts` *(stub copy)* | pure | 3 · Action |
| 7 | HUMAN CHOICE | `ChoiceProvider` port → `app/awareness-window/*` | UI | 4 · Human Sovereignty |
| 8 | REFLECTION | `core/engines/reflection-mirror.ts` *(stub aggregation)* | pure | 2 · Derived Structure, mirrored back |

`core/pipeline/pipeline.ts` wires the stages in order. It owns no domain logic —
only event pull, local persistence, the small state the policy maths needs
(recent intervention timestamps), and telemetry (every outcome, Silence included).

### Stage 1 detail — ingestion (`core/ingestion/`)

```
native adapter ──push "awake:rawEventBatch"──┐
                                             ├─▶ EventCollector ──▶ EventSource.pull()
native adapter ──pull drainPendingEvents()───┘   · normalizeEvent (trust boundary)
                                                 · de-bounce identical signals (I-05)
                                                 · order by occurredAt, bound memory
```

- `raw-event.ts` — `RawNativeEvent`, the flat all-primitive wire shape.
- `event-normalizer.ts` — pure `(RawNativeEvent) -> Event | rejection`. Enforces
  the frozen contract, `schemaVersion` `1.0.0`, allow-listed payloads (**I-02**),
  salted-hash identifiers (**I-09**), plausible timestamps.
- `event-collector.ts` — the production `EventSource`: normalizes, de-bounces OS
  chatter, drains oldest-first, drops oldest on overflow, counts every rejection.
- Bridge wiring (`app/ingestion/`): `native-module.ts` (the Kotlin/Swift JS
  contract) + `createNativeEventSource` (push channel + pull-time backstop, one
  shared collector).

## Decision maths (Stage 5, implemented exactly per spec §4)

```
Eligibility   = PatternConfidence · PotentialValue · ContextRelevance
DecisionScore = Eligibility − InterruptionCost − InterventionFatigue

IF DecisionScore ≤ Threshold  OR  InterventionFatigue > MaxFatigueLimit
     → Silence            (reason: EpistemicUncertainty | InterventionFatigue)
ELSE → Intervene          (reason: HighSalienceThresholdMet)
```

`PotentialValue`, `ContextRelevance`, `InterruptionCost`, `InterventionFatigue`
are derived from **structural inputs only** (I-02) with tunable weights in
`DEFAULT_POLICY_CONFIG`. The rule itself is fixed.

## Ports (the only seams)

`core/pipeline/ports.ts`: `EventSource`, `ChoiceProvider`, `LocalStore`,
`PipelineTelemetry`. The core imports no platform SDK, UI toolkit, or database.
Stub implementations live in `core/adapters-stub/` (used by tests and the E2E
demo run).

## Invariant enforcement in code

`core/invariants/invariants.ts` holds all 13 as data plus runtime guards that
other modules call — a guard throwing means the caller is wrong:

| Guard | Invariants | Called from |
|-------|-----------|-------------|
| `assertStructuralName` | I-11, I-07 | `pattern-detector` on every `structuralName` |
| `assertNonCoerciveText` | I-12, I-10, I-07 | `intervention-factory`, `awareness-window.viewmodel` |
| `assertNoJudgment` | I-07 | `reflection-mirror`, `reflection-mirror.viewmodel` |
| `assertChoiceSymmetry` | I-13 | `app/awareness-window/choice-symmetry.ts` |
| `assertReversible` | I-08 | `intervention-factory` on every modality |

## Package layout

```
packages/
  core/      Pure TS. Contracts + invariants + engines + pipeline. Zero runtime deps.
  adapters/  Native Event collectors (Kotlin / Swift skeletons — Step 1).
  app/       Shell UI. Framework-agnostic view-models (.ts, tested) + RN stubs (.tsx).
```

## Implementation order

1. **Event Collector** — real Android/iOS adapters → normalized `Event`.
2. **Context & Pattern Engine** — replace stub detection with baseline-aware logic.
3. **Intervention Policy Engine** — tune weights; multi-pattern arbitration.
4. **Awareness Window & Choice Symmetry UI** — RN components on the view-models.
5. **Reflection Mirror** — on-device encrypted store + non-judgmental facts UI.

The scaffold runs all 8 stages end-to-end today through stub adapters; see
`packages/core/tests/pipeline.e2e.test.ts`.
