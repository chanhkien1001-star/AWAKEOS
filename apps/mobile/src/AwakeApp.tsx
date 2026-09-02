/**
 * Root component. Assembles the runtime, mounts the Awareness Window host and
 * the Reflection Mirror, and runs a low-frequency tick loop. Reference code —
 * compiled inside a React Native project, not by this repo.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, SafeAreaView, StyleSheet } from 'react-native';

import type { AwakeRuntime } from '@awake-os/app';
import { createAwakeRuntime } from '@awake-os/app';
import { AwarenessWindowHost } from '@awake-os/app/src/awareness-window/AwarenessWindowHost.tsx';
import { ReflectionMirror } from '@awake-os/app/src/reflection-mirror/ReflectionMirror.tsx';
import type { AwarenessWindowPresenter } from '@awake-os/app';

import { buildRuntimeDeps } from './bootstrap.ts';

const TICK_INTERVAL_MS = 15_000;

export function AwakeApp() {
  const presenterRef = useRef<AwarenessWindowPresenter>(null);
  const [runtime, setRuntime] = useState<AwakeRuntime | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const deps = await buildRuntimeDeps(presenterRef.current!);
      if (!disposed) setRuntime(createAwakeRuntime(deps));
    })();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!runtime) return;
    const tick = () => void runtime.tick().catch(() => {});
    const interval = setInterval(tick, TICK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', tick);
    // a daily-ish retention pass
    const prune = setInterval(() => void runtime.prune().catch(() => {}), 6 * 60 * 60_000);
    return () => {
      clearInterval(interval);
      clearInterval(prune);
      sub.remove();
    };
  }, [runtime]);

  return (
    <SafeAreaView style={styles.root}>
      <AwarenessWindowHost ref={presenterRef} />
      {runtime ? (
        <ReflectionMirror now={Date.now()} loadMirror={(s, e) => runtime.reflect(s, e)} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
});
