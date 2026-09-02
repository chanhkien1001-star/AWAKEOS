/**
 * The Usage Access ask. Two equal-weight choices (I-13 in spirit): "Open
 * settings" and "Not now". Declining is always available; the app continues on
 * screen signals only. Reference code — compiled inside the RN project.
 */

import { useEffect, useState } from 'react';
import { AppState, NativeModules, Pressable, StyleSheet, Text, View } from 'react-native';
import { describeUsageAccessRequest, usageAccessStatusLine, type UsageAccessState } from '@awake-os/app';

export function UsageAccessScreen({ onContinue }: { readonly onContinue: () => void }) {
  const copy = describeUsageAccessRequest();
  const [state, setState] = useState<UsageAccessState>('unknown');

  const refresh = async () => {
    try {
      const status = await NativeModules.AwakeEventCollector.getStatus();
      setState(status.permission ?? 'unknown');
    } catch {
      setState('unknown');
    }
  };

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.text}>{copy.body}</Text>
        <Text style={styles.status}>{usageAccessStatusLine(state)}</Text>
        <Text style={styles.note}>{copy.afterReturn}</Text>
      </View>

      <View style={styles.nav}>
        <Pressable style={styles.btn} onPress={() => NativeModules.AwakeEventCollector.openPermissionSettings()}>
          <Text style={styles.btnText}>{copy.grantLabel}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onContinue}>
          <Text style={styles.btnText}>{copy.skipLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d', padding: 28, justifyContent: 'space-between' },
  body: { flex: 1, justifyContent: 'center', gap: 14 },
  title: { color: '#f2f2f2', fontSize: 20 },
  text: { color: '#b8b8b8', fontSize: 15, lineHeight: 23 },
  status: { color: '#8a8a8a', fontSize: 13, marginTop: 8 },
  note: { color: '#6f6f6f', fontSize: 12 },
  nav: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { paddingVertical: 12, paddingHorizontal: 20 },
  btnText: { color: '#eaeaea', fontSize: 16 },
});
