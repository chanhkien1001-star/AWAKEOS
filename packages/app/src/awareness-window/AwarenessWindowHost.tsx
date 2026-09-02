/**
 * STAGE 6/7 — the presenter the pipeline talks to.
 *
 * Mount `<AwarenessWindowHost>` once, near the app root. It exposes an
 * `AwarenessWindowPresenter` (via `hostRef`) that `createAwarenessWindowChoiceProvider`
 * calls: each `present(controller)` mounts one `<AwarenessWindow>` and resolves
 * with the person's `HumanChoice`. At most one window is shown at a time (I-05).
 *
 * Compiled inside a host app (excluded from this package's type-check).
 */

import { useCallback, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Modal } from 'react-native';

import type { HumanChoice } from '@awake-os/core';
import { AwarenessWindow } from './AwarenessWindow.tsx';
import type { AwarenessWindowController } from './awareness-window-controller.ts';
import type { AwarenessWindowPresenter } from './choice-provider-adapter.ts';

export const AwarenessWindowHost = forwardRef<AwarenessWindowPresenter>((_props, ref) => {
  const [controller, setController] = useState<AwarenessWindowController | null>(null);
  const resolveRef = useRef<((c: HumanChoice) => void) | null>(null);

  const present = useCallback(
    (c: AwarenessWindowController) =>
      new Promise<HumanChoice>((resolve) => {
        // Serialise: if a window is somehow already up, resolve the new request
        // as Dismiss rather than stacking overlays.
        if (resolveRef.current) {
          resolve({ id: `dismiss-${Date.now()}`, awarenessWindowId: c.state().vm.windowId, selectedAt: Date.now(), choice: 'Dismiss' });
          return;
        }
        resolveRef.current = resolve;
        setController(c);
      }),
    [],
  );

  useImperativeHandle(ref, () => ({ present }), [present]);

  const onResolved = useCallback((choice: HumanChoice) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setController(null);
    resolve?.(choice);
  }, []);

  if (!controller) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={() => controller.dismiss()}>
      <AwarenessWindow controller={controller} onResolved={onResolved} />
    </Modal>
  );
});
AwarenessWindowHost.displayName = 'AwarenessWindowHost';
