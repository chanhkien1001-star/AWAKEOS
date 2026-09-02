/**
 * STAGE 8 — Reflection Mirror screen (React Native). Thin translation of
 * `describeReflectionMirrorRender`; compiled inside a host app (excluded from
 * this package's type-check).
 *
 * Rules — all enforced by the modules it consumes:
 *  - I-07  plain text rows, one `.map` with the shared `render.rows[i].style`.
 *          No progress bars, no red/green, no ranking, no "you improved". A big
 *          count is not styled differently from a small one.
 *  - I-06  opened deliberately by the person; no badge, no push telling them to
 *          come look.
 *  - the range selector segments are equal-weight (I-13 in spirit): same style,
 *          the active one differs only by a subtle underline, never size/colour.
 *  - empty range shows `render.emptyText`, calmly — a complete state.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ReflectionMirror as ReflectionMirrorData } from '@awake-os/core';
import { toReflectionMirrorViewModel } from './reflection-mirror.viewmodel.ts';
import { describeReflectionMirrorRender } from './reflection-mirror-render.ts';
import {
  REFLECTION_RANGE_PRESETS,
  reflectionRange,
  type ReflectionRangePreset,
} from './reflection-range.ts';

export interface ReflectionMirrorProps {
  readonly now: number;
  /** Build a mirror for the chosen range — wire to `pipeline.reflect(start, end)`. */
  readonly loadMirror: (startMs: number, endMs: number) => Promise<ReflectionMirrorData>;
}

export function ReflectionMirror({ now, loadMirror }: ReflectionMirrorProps) {
  const [preset, setPreset] = useState<ReflectionRangePreset>('last-7-days');
  const [data, setData] = useState<ReflectionMirrorData | null>(null);

  const range = useMemo(() => reflectionRange(now, preset), [now, preset]);

  useMemo(() => {
    let cancelled = false;
    loadMirror(range.startMs, range.endMs).then((m) => {
      if (!cancelled) setData(m);
    });
    return () => {
      cancelled = true;
    };
  }, [range, loadMirror]);

  const render = data ? describeReflectionMirrorRender(toReflectionMirrorViewModel(data)) : null;

  return (
    <View style={styles.screen}>
      <View style={styles.rangeRow}>
        {REFLECTION_RANGE_PRESETS.map((p) => (
          <Pressable key={p} onPress={() => setPreset(p)} style={styles.rangeSegment}>
            <Text style={[styles.rangeLabel, p === preset && styles.rangeLabelActive]}>
              {reflectionRange(now, p).label}
            </Text>
          </Pressable>
        ))}
      </View>

      {render === null ? null : render.isEmpty ? (
        <Text style={styles.empty}>{render.emptyText}</Text>
      ) : (
        <ScrollView>
          {render.rows.map((row) => (
            <View key={row.patternName} style={{ padding: row.style.paddingPx }}>
              <View style={styles.rowTop}>
                <Text style={{ fontSize: row.style.fontSizePx, color: '#eee', flex: 1 }}>{row.patternName}</Text>
                <Text style={{ fontSize: row.style.countFontSizePx, color: '#eee' }}>{row.occurrenceText}</Text>
              </View>
              <Text style={styles.summary}>{row.contextSummary}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d0d0d', paddingTop: 12 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 12 },
  rangeSegment: { paddingVertical: 6, paddingHorizontal: 8 },
  rangeLabel: { fontSize: 13, color: '#8a8a8a' },
  rangeLabelActive: { color: '#e8e8e8', textDecorationLine: 'underline' },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  summary: { marginTop: 4, fontSize: 13, color: '#9a9a9a', lineHeight: 18 },
  empty: { padding: 24, fontSize: 14, color: '#9a9a9a' },
});
