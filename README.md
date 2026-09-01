# Human Agency OS  ·  `awake-os`

A **Human Agency Infrastructure** that sits between a person and their digital
environment and opens a brief **Awareness Window** so an automatic behaviour can
become a conscious choice.

It is **not** a screen-time app, **not** a psychological cop, and **not** a new
thing to be hooked on. Success = the person chose consciously — including when
they choose to continue.

Read [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) (the frozen source spec) and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before contributing.

## Status — Scaffold (all 8 pipeline stages wired end-to-end)

| Stage | State |
|-------|-------|
| Data contracts (8, frozen) | ✅ complete, `schemaVersion 1.0.0` |
| 13 invariants + runtime guards | ✅ complete |
| Context builder | ✅ real (structural/temporal) |
| Pattern detector | 🟡 stub logic, final shape |
| Candidate generator | 🟡 stub logic, final shape |
| **Policy engine (Intervene vs Silence)** | ✅ **real maths, per spec §4** |
| Intervention factory + Awareness Window | 🟡 stub copy, final shape |
| Pipeline orchestrator (E2E) | ✅ complete |
| Reflection mirror | 🟡 stub aggregation, final shape |
| Native adapters (Kotlin/Swift) | ⬜ skeletons only — Step 1 |
| Awareness Window / Reflection UI | 🟡 view-models done + tested; RN components are stubs — Steps 4–5 |

## Layout

```
packages/
  core/      Pure TypeScript. Contracts, invariants, engines, pipeline. Zero runtime deps.
  adapters/  Native Event collectors — Android (Kotlin) & iOS (Swift) skeletons.
  app/       Shell UI. Framework-agnostic view-models (.ts, tested) + React Native stubs (.tsx).
docs/        SPECIFICATION.md (frozen) · ARCHITECTURE.md
```

## Requirements

- **Node ≥ 24** — the `core` and `app` packages run and test as TypeScript
  directly (native type stripping + `node:test`). No build step, no test-runner
  dependency.

## Commands

```bash
npm install          # links workspaces, installs typescript + @types/node

npm test             # run every workspace's test suite
npm run typecheck    # tsc --noEmit across all workspaces

npm run test:core        # core suite only
npm run typecheck:core   # core type-check only
```

The end-to-end walkthrough of `EVENT → … → REFLECTION` through stub adapters is
[`packages/core/tests/pipeline.e2e.test.ts`](packages/core/tests/pipeline.e2e.test.ts).

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
