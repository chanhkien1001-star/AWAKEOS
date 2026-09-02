/**
 * STAGE 7 — React Native overlay. Thin translation of the tested controller +
 * render descriptor; it adds no behaviour of its own.
 *
 * Compiled inside a host app (excluded from this package's type-check).
 *
 * Structural rules it must not break — all enforced by the modules it consumes:
 *  - I-13  every choice is one `.map` over `render.choices` with the SAME
 *          `render.choices[i].style` object. No branch on index, no per-choice
 *          colour, no `autoFocus`, no "recommended" affordance.
 *  - I-12  `<Text>{render.bodyText}</Text>` verbatim. No prefix, emoji, or "?".
 *  - I-08  the full-screen backdrop is a Pressable that calls `controller.dismiss()`.
 *  - I-05  buttons are `disabled={!c.enabled}` (identical for all) until the hold
 *          elapses; a calm progress ring shows the wait, nothing more.
 *  - I-10  no confetti, no sound, no reward on any outcome.
 */

import { useEffect, useReducer } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import type { HumanChoice } from '@awake-os/core';
import type { AwarenessWindowController } from './awareness-window-controller.ts';
import { describeAwarenessWindowRender } from './awareness-window-render.ts';

export interface AwarenessWindowProps {
  readonly controller: AwarenessWindowController;
  /** Called once, when the controller resolves. */
  readonly onResolved: (choice: HumanChoice) => void;
  /** Optional single-beat haptic on open. Defaults to a short Vibration. */
  readonly haptics?: { pulse: () => void };
}

export function AwarenessWindow({ controller, onResolved, haptics }: AwarenessWindowProps) {
  const [, force] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    (haptics?.pulse ?? (() => Vibration.vibrate(12)))();
    const unsubscribe = controller.subscribe((s) => {
      force();
      if (s.phase === 'resolved' && s.result) onResolved(s.result);
    });
    const loop = setInterval(() => controller.tick(), 100);
    return () => {
      unsubscribe();
      clearInterval(loop);
    };
  }, [controller, onResolved, haptics]);

  const render = describeAwarenessWindowRender(controller.state());

  return (
    <Pressable
      style={styles.backdrop}
      accessibilityLabel={render.dismiss.hint}
      onPress={() => controller.dismiss()} // I-08
    >
      <Pressable style={styles.panel} onPress={() => {}}>
        <Text style={styles.body}>{render.bodyText}</Text>

        {render.showsHoldIndicator ? (
          <View style={styles.holdRow}>
            <View style={[styles.holdTrack]}>
              <View style={[styles.holdFill, { flex: render.holdProgress }]} />
              <View style={{ flex: 1 - render.holdProgress }} />
            </View>
          </View>
        ) : (
          <View style={styles.choices}>
            {render.choices.map((c) => (
              <Pressable
                key={c.choice}
                disabled={!c.enabled}
                onPress={() => controller.choose(c.choice)}
                style={{
                  width: c.style.widthPx,
                  height: c.style.heightPx,
                  borderRadius: c.style.borderRadiusPx,
                  backgroundColor: `rgba(127,127,127,${c.style.backgroundOpacity})`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: c.style.fontSizePx }}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Pressable>
    </Pressable>
  );
}

// `Animated`/`Easing` kept imported for the host to wire a fade matching
// c.style.pressAnimationMs; the descriptor stays the source of truth.
void Animated;
void Easing;

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: { maxWidth: 420, padding: 24, borderRadius: 20, backgroundColor: '#111', gap: 20 },
  body: { color: '#f4f4f4', fontSize: 16, lineHeight: 22 },
  holdRow: { paddingVertical: 8 },
  holdTrack: { flexDirection: 'row', height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' },
  holdFill: { backgroundColor: 'rgba(255,255,255,0.5)' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
});
