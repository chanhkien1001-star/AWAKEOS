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
| 3 | PATTERN | `core/engines/pattern-detector.ts` (baseline-aware) + `session-segmenter.ts` + `baseline.ts` | pure, state-free | 2 · Derived Structure |
| 3/4 | ARBITRATION | `core/engines/pattern-arbiter.ts` | pure | 2 · Derived Structure |
| 4 | INTERVENTION CANDIDATE | `core/engines/candidate-generator.ts` | pure | 2 · Derived Structure |
| 5 | INTERVENTION POLICY | `core/engines/policy-engine.ts` + `fatigue.ts` **(real maths)** | pure | 3 · Action gate |
| 6 | INTERVENTION + AWARENESS WINDOW | `core/engines/intervention-factory.ts` | pure | 3 · Action |
| 7 | HUMAN CHOICE | `ChoiceProvider` port → `app/awareness-window/*` | UI | 4 · Human Sovereignty |
| 8 | REFLECTION | `core/engines/reflection-mirror.ts` *(stub aggregation)* | pure | 2 · Derived Structure, mirrored back |

`core/pipeline/pipeline.ts` wires the stages in order. It owns no domain logic —
only event pull, local persistence, resolving the baseline once per `tick()`, and
telemetry (every outcome, Silence included). It holds **no fatigue state**:
intervention history is persisted (`LocalStore.appendInterventionRecord`) and
re-read each event (I-09).

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

### Stage 2/3 detail — Context & baseline-aware Pattern

- `context-builder.ts` — pure `(event, preceding, config) -> Context`: time
  frame, ISO day-of-week, user-configured rest-period flag, and structural
  sequence metrics (events in the last minute, ms since last unlock, continuous
  foreground time of the current app — reset by a `Background`/`Terminated`).
- `session-segmenter.ts` — pure `segmentSessions(events)`: folds the stream into
  `UsageSession` spans (unlock/first-foreground → lock/off/long-idle-gap) with
  structural counts only (duration, app switches, event count, longest repeated
  input run). No labels.
- `baseline.ts` — `computeBaseline(sessions)` / `buildBaselineFromEvents(events)`:
  a `BehavioralBaseline` = per-time-frame robust `DistributionSummary` (median +
  MAD-based spread + p90) of each metric. Structural, local-first, recomputed
  from a trailing window (`app/baseline/local-baseline-provider.ts` caches it and
  feeds `PipelineDeps.getBaseline`).
- `pattern-detector.ts` — `detectPatterns(events, context, baseline, …)` compares
  the live observation against *this person's* distribution for the current time
  frame:
  - `confidence = maturity × logisticTail(robust z-score)` — a thin baseline →
    low confidence → downstream leans to Silence (I-02 / I-04);
  - no usable baseline → conservative cold-start thresholds, confidence hard-capped;
  - an absolute **floor** per category stops trivial values counting for very
    light users;
  - `deviationFromBaselineRatio = observed / baseline median` (a structural
    ratio, never a verdict); every `structuralName` passes `assertStructuralName`.

### Stage 3/4 detail — arbitration (`pattern-arbiter.ts`)

One event can raise several `Pattern`s (a long session is often also dense and
repetitive). Only one Awareness Window may follow (I-05), so `arbitratePatterns`
picks one:

```
arbitrationScore = confidence · categoryWeight · (1 + deviationBoost · normDeviation)
```

The top score wins if it clears `minArbitrationScore`; a broader structure
**subsumes** its facets (`ExtendedDuration` → `Repetition`, `TemporalDensity`),
the rest are marked `OutrankedBySalience`. Every detected pattern still reaches
the Reflection mirror — arbitration only decides what to *act on*.

## Decision maths (Stage 5, implemented exactly per spec §4)

```
Eligibility   = PatternConfidence · PotentialValue · ContextRelevance
DecisionScore = Eligibility − InterruptionCost − InterventionFatigue

IF DecisionScore ≤ Threshold  OR  InterventionFatigue > MaxFatigueLimit
     → Silence            (reason: EpistemicUncertainty | InterventionFatigue)
ELSE → Intervene          (reason: HighSalienceThresholdMet)
```

The rule is fixed. The four quantities are derived from **structural inputs
only** (I-02) with tunable weights in `DEFAULT_POLICY_CONFIG`:

- **PotentialValue** — structural salience + normalised deviation past the baseline.
- **ContextRelevance** — base + rest-period bonus + long-active-app term + long-unbroken-session term.
- **InterruptionCost** — base + per-recent-event cost that *ramps* once the person is mid-burst.
- **InterventionFatigue** — `computeInterventionFatigue` (`fatigue.ts`): exponential
  time-decay, a heavier tally for the pattern's **own category**, and
  per-choice multipliers that are **all ≥ 1** — a conscious `Continue` / `Dismiss`
  quiets future nudges for that structure (I-01 Agency Above Compliance); nothing
  in the feedback loop can push toward intervening *more*.

### Stage 6/7 detail — Awareness Window & Choice (`app/awareness-window/`)

Pure, tested TypeScript; the `.tsx` components are a one-to-one translation.

```
pipeline ─present(window,intervention)→ createAwarenessWindowChoiceProvider
                                          │  toAwarenessWindowViewModel  (I-12 copy, I-13 symmetric choices)
                                          │  createAwarenessWindowController
                                          ▼
              presenter.present(controller) ── AwarenessWindowHost.tsx mounts AwarenessWindow.tsx
                                          │      render = describeAwarenessWindowRender(state)
                                          ▼
                                   HumanChoice ─→ pipeline
```

- `awareness-window-controller.ts` — the lifecycle state machine:
  `holding → ready → resolved`, with `dismiss()` accepted in every non-terminal
  phase. `choicesEnabled` is **one** boolean for every choice (I-13); `choose()`
  is a silent no-op during the mandatory 2000–5000 ms hold (I-05); `dismiss()`
  always yields a first-class `HumanChoice{choice:'Dismiss'}` (I-08); resolution
  is idempotent.
- `awareness-window-render.ts` — `describeAwarenessWindowRender(state)` → a plain
  render descriptor. Re-asserts `assertNonCoerciveText` (I-12) and
  `assertChoiceSymmetry` (I-13) at the last point before pixels; every
  `RenderedChoice` carries the **same frozen `CHOICE_RENDER_STYLE` reference** and
  `emphasis: 'none'`.
- `choice-provider-adapter.ts` — `createAwarenessWindowChoiceProvider` wires the
  above behind the core `ChoiceProvider` port; `presenter` is the RN host, tests
  pass a scripted one.
- The Return: `return-moment.ts` view-model + `ReturnMoment.tsx` (black screen,
  "You are here", one haptic beat, 2 s auto-dismiss, tap to skip — no rewards, I-10).

### Stage 8 detail — Reflection Mirror & local-first storage

- `pattern-detector` output is persisted per detection as a compact
  `PatternObservation` (`{ observedAt, category, structuralName,
  deviationFromBaselineRatio, timeFrame, dayOfWeek, isUserDefinedRestPeriod }`) —
  structure only, no score.
- `reflection-mirror.ts` — `buildReflectionMirror({ observations, range })`:
  groups by structural name, counts, describes each group neutrally. Facts are
  ordered by **time-of-day frame** (a neutral structural order), NEVER by count
  (ranking is I-07). `assertNoJudgment` guards the result.
- `pipeline.reflect(start, end)` reads observations back from the store and
  rebuilds the mirror — it survives a restart.
- `app/reflection-mirror/`: `reflection-range.ts` (calendar-window presets, no
  streaks), `reflection-mirror-render.ts` (`describeReflectionMirrorRender` — one
  shared row style, plain-text counts, order preserved, `assertNoJudgment`
  re-checked), `ReflectionMirror.tsx` (plain rows, calm empty state).

**Local-first storage** (`core/storage/`):

```
LocalStore  ──createPersistentLocalStore──▶ StorageBackend (bytes)  +  EncryptionPort
   (events, choices, intervention records,     MMKV / SQLite / files     AES-256-GCM
    pattern observations, reflections)         (app sandbox, no network)  key in keystore
```

- Every record is JSON → `encrypt` → backend; the backend only ever holds
  ciphertext. Logs are lazily loaded once and served from memory.
- `prune(now)` enforces `RetentionPolicy`: raw events 30 d, choices 30 d,
  intervention records 14 d, pattern observations 180 d, reflections 365 d.
  Retention deletion is one-way and privacy-positive (I-09).
- App adapters: `createMmkvStorageBackend(mmkv)` and
  `createAesGcmEncryption({ subtle, random, keyBytes })` (standard WebCrypto;
  Node and `react-native-quick-crypto` both satisfy it).

## Ports (the only seams)

`core/pipeline/ports.ts`: `EventSource`, `ChoiceProvider`, `LocalStore` (events,
choices, **intervention records**, **pattern observations**, reflections),
`PipelineTelemetry`. `core/storage/ports.ts`: `StorageBackend`, `EncryptionPort`.
The core imports no platform SDK, UI toolkit, or database. Stub implementations
live in `core/adapters-stub/`.

## Invariant enforcement in code

`core/invariants/invariants.ts` holds all 13 as data plus runtime guards that
other modules call — a guard throwing means the caller is wrong:

| Guard | Invariants | Called from |
|-------|-----------|-------------|
| `assertStructuralName` | I-11, I-07 | `pattern-detector` on every `structuralName` (`baseline`/`session-segmenter` emit metrics only) |
| `assertNonCoerciveText` | I-12, I-10, I-07 | `intervention-factory`, `awareness-window.viewmodel` |
| `assertNoJudgment` | I-07 | `reflection-mirror`, `reflection-mirror.viewmodel` + re-checked in `reflection-mirror-render.ts` |
| `assertChoiceSymmetry` | I-13 | `app/awareness-window/choice-symmetry.ts` + re-checked in `awareness-window-render.ts` |
| `assertNonCoerciveText` | I-12 | also re-checked in `awareness-window-render.ts` before pixels |
| `assertReversible` | I-08 | `intervention-factory` on every modality; controller `dismiss()` is always live |

## Package layout

```
packages/
  core/      Pure TS. Contracts + invariants + ingestion + engines + pipeline + storage. Zero runtime deps.
  adapters/  Native Event collectors — Android (Kotlin) & iOS (Swift) reference impl.
  app/       Shell UI. View-models + controllers + render descriptors + ingestion/storage adapters
             (.ts, tested) + RN components (.tsx, translated in a host app).
```

## Implementation order

1. ✅ **Event Collector** — native adapters + `core/ingestion` normalize/collect/de-bounce.
2. ✅ **Context & Pattern Engine** — baseline-aware detection (`session-segmenter`,
   `baseline`, `pattern-detector`); `getBaseline` threaded through the pipeline.
3. ✅ **Intervention Policy Engine** — `pattern-arbiter` (multi-pattern arbitration
   + subsumption), `fatigue` (decayed, per-category, choice-aware), tuned
   relevance/cost terms, intervention history persisted in `LocalStore`.
4. ✅ **Awareness Window & Choice Symmetry UI** — tested controller +
   render descriptor + `ChoiceProvider` adapter; RN `AwarenessWindow.tsx` /
   `AwarenessWindowHost.tsx` / `ReturnMoment.tsx` translate them.
5. ✅ **Reflection Mirror** — `PatternObservation`s persisted; `buildReflectionMirror`
   rebuilds from the store; `createPersistentLocalStore` (encrypted, retention/prune)
   with MMKV + AES-GCM app adapters; render descriptor + `ReflectionMirror.tsx`.

All five steps have real logic — including the Stage 4 candidate generator
(salience from confidence + baseline deviation + category weight, amplified by
rest period / unbroken session) and the Stage 6 intervention factory
(salience-aware modality + 2–5 s hold + transparent per-structure copy).

## Running the engine

- **`createAwakeRuntime(deps)`** (`app/src/runtime/awake-runtime.ts`) assembles
  `PersistentLocalStore` + `LocalBaselineProvider` + `Pipeline` from the ports.
  A host passes platform ports; tests pass stubs.
- **`npm run demo`** (`app/src/demo/run-demo.ts`) drives a synthetic 14-day
  history + a 45-minute evening through the runtime with a headless
  `ChoiceProvider` (the real Awareness Window controller, console-printed). It is
  a living smoke test — `app/tests/demo.test.ts` asserts it produces ≥1 window,
  Silence of both kinds, and a non-judgmental mirror.
- **`apps/mobile/`** — reference RN host: `bootstrap.ts` (native module +
  `react-native-mmkv` backend + Keychain key + `react-native-quick-crypto`
  webcrypto) and `AwakeApp.tsx` (mounts `AwarenessWindowHost` + `ReflectionMirror`,
  runs a 15 s tick loop + 6 h prune).
- **CI** (`.github/workflows/ci.yml`): `npm ci` → typecheck → tests → demo, on
  push / PR to `main`/`master`.

The engine runs end-to-end through the pure core and stub adapters; the
platform-native pieces (Kotlin/Swift collectors, RN components) are complete
reference code compiled in a host app. See `packages/core/tests/*.e2e.test.ts`.
