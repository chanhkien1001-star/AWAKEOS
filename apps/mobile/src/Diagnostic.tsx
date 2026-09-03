/**
 * Bare React Native screen — zero native modules, zero @awake-os deps. Built by
 * the android-apk workflow when `minimal: true`, to isolate whether this device
 * can sideload a plain RN APK at all.
 */

import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

export function Diagnostic() {
  const c = Platform.constants as Record<string, unknown>;
  const rn = c.reactNativeVersion as { major?: number; minor?: number; patch?: number } | undefined;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      <Text style={styles.h}>AwakeOS — bare RN diagnostic</Text>
      <Text style={styles.p}>
        If you can read this, sideloading a plain React Native APK works on this device. The install
        failures were caused by one of the native libraries (quick-crypto / mmkv), not the ROM.
      </Text>
      <View style={styles.box}>
        <Row k="Brand" v={String(c.Brand ?? '?')} />
        <Row k="Model" v={String(c.Model ?? '?')} />
        <Row k="Android API" v={String(Platform.Version)} />
        <Row k="Android release" v={String(c.Release ?? '?')} />
        <Row k="RN" v={rn ? `${rn.major}.${rn.minor}.${rn.patch}` : '?'} />
        <Row k="Hermes" v={String((globalThis as { HermesInternal?: unknown }).HermesInternal ? 'yes' : 'no')} />
      </View>
    </ScrollView>
  );
}

function Row({ k, v }: { readonly k: string; readonly v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v} selectable>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  pad: { padding: 24, gap: 16 },
  h: { color: '#f2f2f2', fontSize: 20 },
  p: { color: '#b0b0b0', fontSize: 14, lineHeight: 21 },
  box: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  k: { color: '#8a8a8a', fontSize: 13 },
  v: { color: '#e8e8e8', fontSize: 13 },
});
