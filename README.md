# Human Agency OS  ·  `awake-os`

A **Human Agency Infrastructure** that sits between a person and their digital
environment and opens a brief **Awareness Window** so an automatic behaviour can
become a conscious choice.

It is **not** a screen-time app, **not** a psychological cop, and **not** a new
thing to be hooked on. Success = the person chose consciously — including when
they choose to continue.

Read [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) (the frozen source spec) and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before contributing.

## Status — all 5 implementation steps have real logic; end-to-end through the pure core

| Stage | State |
|-------|-------|
| Data contracts (8, frozen) | ✅ complete, `schemaVersion 1.0.0` |
| 13 invariants + runtime guards | ✅ complete |
| **Stage 1 · Event Collector** | ✅ normalizer + collector + bridge wiring done & tested; native Kotlin/Swift reference impl complete |
| **Stage 2 · Context builder** | ✅ real (structural/temporal), dedicated tests |
| **Stage 2/3 · Session segmenter + Behavioural baseline** | ✅ pure `segmentSessions` + `computeBaseline` (per-time-frame robust distributions); `local-baseline-provider` caches & feeds the pipeline |
| **Stage 3 · Pattern detector** | ✅ baseline-aware: unusual *for this person*, maturity-weighted confidence, cold-start fallback, absolute floors |
| **Stage 4 · Candidate generator** | ✅ salience = confidence + deviation + category weight, amplified by rest period / unbroken session |
| **Stage 3/4 · Pattern arbitration** | ✅ salience ranking + subsumption (one Awareness Window per event, I-05) |
| **Stage 5 · Policy engine (Intervene vs Silence)** | ✅ real maths per spec §4; tuned relevance/cost terms |
| **Stage 5 · Fatigue model** | ✅ time-decay + per-category + choice-aware (a conscious `Continue` quiets that structure — I-01); intervention history persisted in `LocalStore` |
| **Stage 6 · Intervention factory** | ✅ salience-aware modality + 2–5 s hold; transparent per-structure copy through `assertNonCoerciveText` |
| **Stage 6/7 · Awareness Window UI** | ✅ tested lifecycle controller (hold → ready → resolved, always-dismissible) + render descriptor (one shared choice style, verbatim copy) + `ChoiceProvider` adapter; RN `AwarenessWindow.tsx` / `AwarenessWindowHost.tsx` / `ReturnMoment.tsx` translate them |
| Pipeline orchestrator (E2E) | ✅ complete |
| **Stage 8 · Reflection mirror** | ✅ `PatternObservation`s persisted; `buildReflectionMirror` groups + counts, ordered by time-of-day never by count (I-07); rebuilt from the store on `reflect()` |
| **Local-first storage** | ✅ `createPersistentLocalStore` — JSON → `EncryptionPort` → `StorageBackend` (ciphertext only), lazy-loaded, `prune()` retention; app adapters `createMmkvStorageBackend` + `createAesGcmEncryption` (AES-256-GCM) |
| Native adapters (Kotlin/Swift) | ✅ full reference impl (screen + app-usage observers, salted hashing, RN module); compiles in an RN host, not in this repo |
| Reflection UI | ✅ render descriptor (one row style, plain counts, order preserved) + range presets + `ReflectionMirror.tsx` |
| **Runtime assembly** | ✅ `createAwakeRuntime` wires store + baseline provider + consent filter + pipeline from ports; `eraseAllData()` |
| **Settings** | ✅ `UserSettings` + encrypted `SettingsStore` + `mapSettingsToRuntimeConfig`; rest periods, observed-apps consent filter, retention, `interventionsEnabled` master switch (I-01) → `Muted` outcome |
| **Onboarding + permission copy** | ✅ `ONBOARDING_STEPS` + `describeUsageAccessRequest` — all strings guarded non-coercive at load |
| **Runnable demo** | ✅ `npm run demo` — narrated end-to-end run on synthetic usage; covered by a CI smoke test |
| **CI** | ✅ `.github/workflows/ci.yml` — typecheck + tests + demo on push/PR |
| **Mobile host** | 📄 `apps/mobile/` — screens (`OnboardingScreen`, `UsageAccessScreen`, `SettingsScreen`, routed `AwakeApp`) + wiring; needs `npx react-native init` for the `android/` project |
| **Play Store release** | 📄 `docs/RELEASE.md` + `docs/PRIVACY.md` + `docs/PLAY-PERMISSIONS.md` |

## Layout

```
packages/
  core/      Pure TypeScript. Contracts, invariants, ingestion, engines, pipeline. Zero runtime deps.
             src/ingestion/ — Stage 1: RawNativeEvent → normalizeEvent → EventCollector (EventSource).
             src/engines/  — Stage 2/3: context-builder, session-segmenter, baseline, pattern-detector.
  adapters/  Native Event collectors — Android (Kotlin) & iOS (Swift) reference implementations.
  app/       Shell UI. View-models + controllers + render descriptors + ingestion/storage adapters
             + runtime assembly + demo (.ts, tested) + React Native components (.tsx).
apps/
  mobile/    React Native host — reference wiring (bootstrap.ts, AwakeApp.tsx). Not a workspace.
docs/        SPECIFICATION.md (frozen) · ARCHITECTURE.md
```

## Requirements

- **Node ≥ 24** — the `core` and `app` packages run and test as TypeScript
  directly (native type stripping + `node:test`). No build step, no test-runner
  dependency.

## Commands

```bash
npm install          # links workspaces, installs typescript + @types/node

npm run demo         # narrated end-to-end run on a synthetic evening
npm test             # run every workspace's test suite
npm run typecheck    # tsc --noEmit across all workspaces
npm run verify       # typecheck + test + demo (what CI runs)

npm run test:core        # core suite only
npm run typecheck:core   # core type-check only
```

`npm run demo` ([source](packages/app/src/demo/run-demo.ts)) feeds a synthetic
14-day history + a 45-minute evening session through the real engine and prints
the policy decisions, the Awareness Window, the fatigue-driven back-off after a
conscious `Continue`, and the Reflection Mirror. It runs in CI as a smoke test.

The end-to-end walkthrough of `EVENT → … → REFLECTION` through stub adapters is
[`packages/core/tests/pipeline.e2e.test.ts`](packages/core/tests/pipeline.e2e.test.ts);
the encrypted-storage path is
[`reflection.e2e.test.ts`](packages/core/tests/reflection.e2e.test.ts).

## Non-negotiables for every change

- Contracts in `packages/core/src/contracts/` are **frozen**. Extend via a new
  `schemaVersion`, never by editing a shape.
- No stage may infer a mental or emotional state (**I-02**). Observe structure.
- Name concepts by structure, never by presumed meaning (**I-11**):
  `ExtendedContinuousInteractionPattern`, never `DoomscrollingPattern`.
- `Silence` is a successful outcome (**I-04**). Never treat it as an error.
- All processing is on-device by default (**I-09**). Adapters make no network
  calls.
- `[Continue]` and `[Exit]` always carry identical visual/interactive weight
  (**I-13**); nothing is auto-focused.
