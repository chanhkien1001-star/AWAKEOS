/**
 * Root component. Reads settings, routes first-run onboarding -> Usage Access ->
 * main, assembles the runtime, runs a low-frequency tick loop, and exposes the
 * settings screen. Reference code — compiled inside a React Native project.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import type { AwakeRuntime, AwarenessWindowPresenter, SettingsStore, UserSettings } from '@awake-os/app';
import { createAwakeRuntime, createSettingsStore } from '@awake-os/app';
import { AwarenessWindowHost } from '@awake-os/app/awareness-window/AwarenessWindowHost.tsx';
import { ReflectionMirror } from '@awake-os/app/reflection-mirror/ReflectionMirror.tsx';

import { buildRuntimeDeps, buildStorage } from './bootstrap.ts';
import { OnboardingScreen } from './OnboardingScreen.tsx';
import { UsageAccessScreen } from './UsageAccessScreen.tsx';
import { SettingsScreen } from './SettingsScreen.tsx';

const TICK_INTERVAL_MS = 15_000;

type Route = 'loading' | 'onboarding' | 'usage-access' | 'main' | 'settings';

export function AwakeApp() {
  const presenterRef = useRef<AwarenessWindowPresenter>(null);
  const [settingsStore, setSettingsStore] = useState<SettingsStore | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [runtime, setRuntime] = useState<AwakeRuntime | null>(null);
  const [route, setRoute] = useState<Route>('loading');

  // 1. storage + settings
  useEffect(() => {
    const { backend, encryption } = buildStorage();
    Promise.resolve(encryption).then((enc) => {
      const store = createSettingsStore({ backend, encryption: enc });
      setSettingsStore(store);
      store.read().then((s) => {
        setSettings(s);
        setRoute(s.onboardingComplete ? 'main' : 'onboarding');
      });
    });
  }, []);

  // 2. runtime — (re)built whenever settings change
  const rebuild = useCallback(
    async (s: UserSettings) => {
      if (!settingsStore) return;
      const deps = await buildRuntimeDeps(presenterRef.current!, settingsStore, s);
      setRuntime(createAwakeRuntime(deps));
    },
    [settingsStore],
  );
  useEffect(() => {
    if (settings && (route === 'main' || route === 'settings')) void rebuild(settings);
  }, [settings, route, rebuild]);

  // 3. tick loop
  useEffect(() => {
    if (!runtime) return;
    const tick = () => void runtime.tick().catch(() => {});
    const t = setInterval(tick, TICK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', tick);
    const prune = setInterval(() => void runtime.prune().catch(() => {}), 6 * 60 * 60_000);
    return () => {
      clearInterval(t);
      clearInterval(prune);
      sub.remove();
    };
  }, [runtime]);

  const completeOnboarding = async () => {
    const next = await settingsStore!.update({ onboardingComplete: true });
    setSettings(next);
    setRoute('usage-access');
  };

  return (
    <SafeAreaView style={styles.root}>
      <AwarenessWindowHost ref={presenterRef} />

      {route === 'onboarding' && <OnboardingScreen onDone={completeOnboarding} />}
      {route === 'usage-access' && <UsageAccessScreen onContinue={() => setRoute('main')} />}

      {route === 'settings' && settingsStore && runtime && (
        <SettingsScreen
          settingsStore={settingsStore}
          onSaved={(s) => setSettings(s)}
          onEraseAll={async () => {
            await runtime.eraseAllData();
            const s = await settingsStore.read();
            setSettings(s);
            setRoute('onboarding');
          }}
        />
      )}

      {route === 'main' && runtime && (
        <View style={styles.main}>
          <Pressable style={styles.gear} onPress={() => setRoute('settings')}>
            <Text style={styles.gearText}>Settings</Text>
          </Pressable>
          <ReflectionMirror now={Date.now()} loadMirror={(from, to) => runtime.reflect(from, to)} />
        </View>
      )}

      {route === 'settings' && (
        <Pressable style={styles.back} onPress={() => setRoute('main')}>
          <Text style={styles.gearText}>Done</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  main: { flex: 1 },
  gear: { alignSelf: 'flex-end', padding: 14 },
  back: { position: 'absolute', top: 8, right: 8, padding: 12 },
  gearText: { color: '#9db4ff', fontSize: 14 },
});
