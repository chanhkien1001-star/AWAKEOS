/**
 * STAGE 7 — [AWARENESS WINDOW & HUMAN CHOICE] · the lifecycle controller.
 *
 * A pure, renderer-agnostic state machine for one Awareness Window. The React
 * Native component (`AwarenessWindow.tsx`) is a thin translation of this — all
 * the invariant-critical behaviour lives here where it can be tested:
 *
 *   holding ──(hold elapsed)──▶ ready ──(choose)──▶ resolved
 *      └────────────────(dismiss, any time)───────────▶ resolved
 *
 *  - I-05  a brief mandatory hold (2000-5000ms): `choose()` is a silent no-op
 *          until it elapses — the pause is the whole point of the window.
 *  - I-13  `choicesEnabled` is ONE boolean for every choice. There is no
 *          per-choice enable, no "Exit lights up first".
 *  - I-08  `dismiss()` is accepted in every non-terminal phase and yields a
 *          first-class `HumanChoice { choice: 'Dismiss' }`.
 *  - I-01/I-03  the outcome is whatever the person selected — `Continue`,
 *          `Dismiss` and the rest are all complete, valid results; the optional
 *          note is theirs alone.
 */

import type { ChoiceType, Clock, HumanChoice, IdFactory } from '@awake-os/core';
import type { AwarenessWindowViewModel } from './awareness-window.viewmodel.ts';

export type AwarenessWindowPhase = 'holding' | 'ready' | 'resolved';

export interface AwarenessWindowState {
  readonly phase: AwarenessWindowPhase;
  readonly vm: AwarenessWindowViewModel;
  /** Milliseconds left in the mandatory hold; 0 once `ready`. */
  readonly holdRemainingMs: number;
  /** Single flag applied to every choice control alike (I-13). */
  readonly choicesEnabled: boolean;
  /** The chosen outcome, or null until `resolved`. */
  readonly result: HumanChoice | null;
}

export interface AwarenessWindowController {
  state(): AwarenessWindowState;
  /** Advance time (from the render loop). Pass an explicit epoch-ms or omit to read the clock. */
  tick(nowMs?: number): void;
  /** The person picked a choice. No-op while `holding` or once `resolved`. */
  choose(choice: ChoiceType, note?: string): void;
  /** Background tap / hardware back / escape gesture — always allowed (I-08). */
  dismiss(): void;
  subscribe(listener: (state: AwarenessWindowState) => void): () => void;
}

export interface AwarenessWindowControllerConfig {
  /** Enforce the mandatory hold. Default true. */
  readonly enforceHold: boolean;
  /** Hold clamp, matching the Intervention contract's 2000-5000ms. */
  readonly minHoldMs: number;
  readonly maxHoldMs: number;
}

export const DEFAULT_AWARENESS_WINDOW_CONFIG: AwarenessWindowControllerConfig = Object.freeze({
  enforceHold: true,
  minHoldMs: 2_000,
  maxHoldMs: 5_000,
});

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function createAwarenessWindowController(deps: {
  readonly vm: AwarenessWindowViewModel;
  readonly ids: IdFactory;
  readonly clock: Clock;
  readonly openedAtMs?: number;
  readonly config?: Partial<AwarenessWindowControllerConfig>;
}): AwarenessWindowController {
  const cfg: AwarenessWindowControllerConfig = { ...DEFAULT_AWARENESS_WINDOW_CONFIG, ...deps.config };
  const openedAt = deps.openedAtMs ?? deps.clock.now();
  const holdMs = cfg.enforceHold ? clamp(deps.vm.holdMs, cfg.minHoldMs, cfg.maxHoldMs) : 0;

  let phase: AwarenessWindowPhase = holdMs > 0 ? 'holding' : 'ready';
  let result: HumanChoice | null = null;
  let now = openedAt;
  const listeners = new Set<(s: AwarenessWindowState) => void>();

  const sync = (explicit?: number) => {
    now = Math.max(now, deps.clock.now(), explicit ?? 0);
    if (phase === 'holding' && now - openedAt >= holdMs) phase = 'ready';
  };

  const computeState = (): AwarenessWindowState => ({
    phase,
    vm: deps.vm,
    holdRemainingMs: phase === 'holding' ? Math.max(0, holdMs - (now - openedAt)) : 0,
    choicesEnabled: phase === 'ready',
    result,
  });

  const emit = () => {
    const s = computeState();
    for (const l of listeners) l(s);
  };

  const resolveWith = (choice: ChoiceType, note?: string) => {
    if (phase === 'resolved') return;
    sync();
    result = {
      id: deps.ids.uuid(),
      awarenessWindowId: deps.vm.windowId,
      selectedAt: now,
      choice,
      ...(note !== undefined ? { userSovereignNote: note } : {}),
    };
    phase = 'resolved';
    emit();
  };

  return {
    state: computeState,
    tick(nowMs) {
      if (phase === 'resolved') return;
      sync(nowMs);
      emit();
    },
    choose(choice, note) {
      if (phase === 'resolved') return;
      sync();
      if (phase === 'holding') return; // I-05: the pause is mandatory and minimal
      resolveWith(choice, note);
    },
    dismiss() {
      resolveWith('Dismiss'); // I-08: escapable at any time
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
