/**
 * "The Return" — React Native. Thin translation of `toReturnMomentViewModel`.
 * Compiled inside a host app (excluded from this package's type-check).
 *
 *  - full-bleed black, centred "You are here";
 *  - exactly ONE haptic beat on mount;
 *  - auto-dismiss after 2s; a tap dismisses early (I-08);
 *  - I-10: no confetti, no sound, no points, no "session summary". The `no*`
 *    flags on the view-model exist so a reviewer can see that at a glance.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, Vibration } from 'react-native';

import { toReturnMomentViewModel } from './return-moment.ts';

export interface ReturnMomentProps {
  readonly onDismiss: () => void;
  readonly haptics?: { pulse: () => void };
}

export function ReturnMoment({ onDismiss, haptics }: ReturnMomentProps) {
  const vm = toReturnMomentViewModel();

  useEffect(() => {
    (haptics?.pulse ?? (() => Vibration.vibrate(12)))();
    const t = setTimeout(onDismiss, vm.autoDismissMs);
    return () => clearTimeout(t);
  }, [onDismiss, haptics, vm.autoDismissMs]);

  return (
    <Pressable
      style={[styles.fill, { backgroundColor: vm.backgroundColor }]}
      accessibilityLabel={vm.text}
      onPress={onDismiss}
    >
      <Text style={styles.text}>{vm.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#eaeaea', fontSize: 22, letterSpacing: 0.5 },
});
