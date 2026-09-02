/**
 * STAGE 6 -> 7 bridge — satisfies the core `ChoiceProvider` port with the real UI.
 *
 *   pipeline ──present(window, intervention)──▶ createAwarenessWindowChoiceProvider
 *        ▲                                             │  build view-model
 *        │                                             │  create controller
 *        └────────────── HumanChoice ◀──── presenter.present(controller)
 *
 * `presenter` is implemented by the React Native host (`AwarenessWindowHost.tsx`):
 * it mounts the overlay, drives `controller.tick()` from the render loop, and
 * calls `choose()` / `dismiss()` from the buttons and the background. Tests pass
 * a scripted presenter instead.
 */

import type { ChoiceProvider, Clock, HumanChoice, IdFactory } from '@awake-os/core';
import { toAwarenessWindowViewModel } from './awareness-window.viewmodel.ts';
import {
  createAwarenessWindowController,
  type AwarenessWindowController,
  type AwarenessWindowControllerConfig,
} from './awareness-window-controller.ts';

export interface AwarenessWindowPresenter {
  /** Show the window; resolve once the controller reaches `resolved`. */
  present(controller: AwarenessWindowController): Promise<HumanChoice>;
}

export function createAwarenessWindowChoiceProvider(deps: {
  readonly ids: IdFactory;
  readonly clock: Clock;
  readonly presenter: AwarenessWindowPresenter;
  readonly config?: Partial<AwarenessWindowControllerConfig>;
}): ChoiceProvider {
  return {
    async present(window, intervention) {
      const vm = toAwarenessWindowViewModel(intervention, window);
      const controller = createAwarenessWindowController({
        vm,
        ids: deps.ids,
        clock: deps.clock,
        openedAtMs: window.openedAt,
        ...(deps.config !== undefined ? { config: deps.config } : {}),
      });
      return deps.presenter.present(controller);
    },
  };
}

/**
 * A presenter that resolves as soon as the controller does — the base the RN
 * host builds on. On its own it never chooses anything, so it is only useful
 * when something else drives the controller (the RN component, or a test).
 */
export function awaitResolution(controller: AwarenessWindowController): Promise<HumanChoice> {
  return new Promise((resolve) => {
    const existing = controller.state();
    if (existing.phase === 'resolved' && existing.result) {
      resolve(existing.result);
      return;
    }
    const unsubscribe = controller.subscribe((s) => {
      if (s.phase === 'resolved' && s.result) {
        unsubscribe();
        resolve(s.result);
      }
    });
  });
}
