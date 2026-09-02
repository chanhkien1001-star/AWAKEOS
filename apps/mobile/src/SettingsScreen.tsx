/**
 * Settings — the person's controls (I-03, I-09). Reference code.
 *
 *  - Awareness Windows on/off (master switch, I-01). Off still keeps the mirror.
 *  - Rest periods (fed to the Context stage).
 *  - Observed apps: all, or an allow-list.
 *  - Data: retention in days, and "Erase all data".
 *
 * Persists through `SettingsStore`; the caller rebuilds the runtime on save so
 * the change takes effect.
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { SettingsStore, UserSettings } from '@awake-os/app';

export function SettingsScreen({
  settingsStore,
  onEraseAll,
  onSaved,
}: {
  readonly settingsStore: SettingsStore;
  readonly onEraseAll: () => Promise<void>;
  readonly onSaved: (next: UserSettings) => void;
}) {
  const [s, setS] = useState<UserSettings | null>(null);
  useEffect(() => {
    void settingsStore.read().then(setS);
  }, [settingsStore]);
  if (!s) return null;

  const save = async (patch: Partial<UserSettings>) => {
    const next = await settingsStore.update(patch);
    setS(next);
    onSaved(next);
  };

  const confirmErase = () =>
    Alert.alert('Erase all data?', 'This deletes every event, pattern, choice and reflection on this device. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase', style: 'destructive', onPress: () => void onEraseAll() },
    ]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Row label="Awareness Windows">
        <Switch value={s.interventionsEnabled} onValueChange={(v) => void save({ interventionsEnabled: v })} />
      </Row>
      <Hint>When off, the app still observes and updates the Reflection view, but never opens a window.</Hint>

      <Section title="Rest periods" />
      {s.restPeriods.map((w, i) => (
        <Row key={i} label={`${pad(w.startHour)}:00 – ${pad(w.endHour)}:00`}>
          <Pressable
            onPress={() => void save({ restPeriods: s.restPeriods.filter((_, k) => k !== i) })}
          >
            <Text style={styles.link}>Remove</Text>
          </Pressable>
        </Row>
      ))}
      <HourRangeAdder onAdd={(startHour, endHour) => void save({ restPeriods: [...s.restPeriods, { startHour, endHour }] })} />

      <Section title="Observed apps" />
      <Row label="Observe all apps">
        <Switch
          value={s.observedApps.mode === 'all'}
          onValueChange={(v) => void save({ observedApps: v ? { mode: 'all' } : { mode: 'allowlist', allow: [] } })}
        />
      </Row>
      {s.observedApps.mode === 'allowlist' ? (
        <Hint>Allow-list editing (pick from recently seen apps) is added with the app-picker UI.</Hint>
      ) : null}

      <Section title="Data" />
      <Row label="Keep raw events (days)">
        <NumberField value={s.retentionDays.rawEvents} onCommit={(n) => void save({ retentionDays: { ...s.retentionDays, rawEvents: n } })} />
      </Row>
      <Row label="Keep reflections (days)">
        <NumberField value={s.retentionDays.reflections} onCommit={(n) => void save({ retentionDays: { ...s.retentionDays, reflections: n } })} />
      </Row>

      <Pressable style={styles.erase} onPress={confirmErase}>
        <Text style={styles.eraseText}>Erase all data</Text>
      </Pressable>
    </ScrollView>
  );
}

const pad = (h: number) => String(h).padStart(2, '0');

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}
function Section({ title }: { readonly title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}
function Hint({ children }: { readonly children: React.ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}
function NumberField({ value, onCommit }: { readonly value: number; readonly onCommit: (n: number) => void }) {
  const [t, setT] = useState(String(value));
  return (
    <TextInput
      style={styles.input}
      keyboardType="number-pad"
      value={t}
      onChangeText={setT}
      onEndEditing={() => {
        const n = Math.max(1, Math.round(Number(t) || value));
        setT(String(n));
        onCommit(n);
      }}
    />
  );
}
function HourRangeAdder({ onAdd }: { readonly onAdd: (startHour: number, endHour: number) => void }) {
  const [a, setA] = useState('23');
  const [b, setB] = useState('7');
  return (
    <View style={styles.row}>
      <TextInput style={styles.input} keyboardType="number-pad" value={a} onChangeText={setA} />
      <Text style={styles.rowLabel}>to</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={b} onChangeText={setB} />
      <Pressable onPress={() => onAdd(clampHour(a), clampHour(b))}>
        <Text style={styles.link}>Add</Text>
      </Pressable>
    </View>
  );
}
const clampHour = (s: string) => Math.max(0, Math.min(24, Math.round(Number(s) || 0)));

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 20, gap: 6 },
  section: { color: '#8a8a8a', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 22, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 10 },
  rowLabel: { color: '#e6e6e6', fontSize: 15, flexShrink: 1 },
  hint: { color: '#7a7a7a', fontSize: 12, lineHeight: 17 },
  link: { color: '#9db4ff', fontSize: 14 },
  input: { color: '#eee', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 56, textAlign: 'center' },
  erase: { marginTop: 32, paddingVertical: 14, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,90,90,0.12)' },
  eraseText: { color: '#ff8a8a', fontSize: 15 },
});
