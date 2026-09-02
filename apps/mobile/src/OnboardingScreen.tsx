/**
 * First-run explainer. A pager over `ONBOARDING_STEPS` (copy lives in
 * `@awake-os/app`, checked non-coercive at load). No animation gimmicks, no
 * "get started now!" — one calm screen per idea, Back / Next / Done.
 * Reference code — compiled inside the RN project.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ONBOARDING_STEPS } from '@awake-os/app';

export function OnboardingScreen({ onDone }: { readonly onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = ONBOARDING_STEPS[i];
  const last = i === ONBOARDING_STEPS.length - 1;

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.text}>{step.body}</Text>
      </View>

      <View style={styles.dots}>
        {ONBOARDING_STEPS.map((s, k) => (
          <View key={s.id} style={[styles.dot, k === i && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.nav}>
        <Pressable style={styles.btn} disabled={i === 0} onPress={() => setI((n) => n - 1)}>
          <Text style={[styles.btnText, i === 0 && styles.btnTextDim]}>Back</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => (last ? onDone() : setI((n) => n + 1))}>
          <Text style={styles.btnText}>{last ? 'Done' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d', padding: 28, justifyContent: 'space-between' },
  body: { flex: 1, justifyContent: 'center', gap: 16 },
  title: { color: '#f2f2f2', fontSize: 22 },
  text: { color: '#b8b8b8', fontSize: 16, lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { backgroundColor: 'rgba(255,255,255,0.7)' },
  nav: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { paddingVertical: 12, paddingHorizontal: 20 },
  btnText: { color: '#eaeaea', fontSize: 16 },
  btnTextDim: { color: '#555' },
});
