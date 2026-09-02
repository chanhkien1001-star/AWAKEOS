/**
 * Time-range presets for the Reflection Mirror screen. Pure.
 *
 * The ranges are plain calendar windows. There is deliberately no "streak" range,
 * no "since you started", no comparison-to-last-period — a mirror shows a window
 * of facts, nothing that invites a score (I-07).
 */

export type ReflectionRangePreset = 'last-7-days' | 'last-30-days' | 'this-week' | 'today';

export interface ReflectionRange {
  readonly preset: ReflectionRangePreset;
  readonly startMs: number;
  readonly endMs: number;
  readonly label: string;
}

const DAY = 24 * 60 * 60_000;

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function reflectionRange(nowMs: number, preset: ReflectionRangePreset): ReflectionRange {
  const endMs = nowMs;
  switch (preset) {
    case 'today': {
      return { preset, startMs: startOfUtcDay(nowMs), endMs, label: 'Today' };
    }
    case 'this-week': {
      const isoDow = ((new Date(nowMs).getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
      return { preset, startMs: startOfUtcDay(nowMs) - (isoDow - 1) * DAY, endMs, label: 'This week' };
    }
    case 'last-30-days':
      return { preset, startMs: nowMs - 30 * DAY, endMs, label: 'Last 30 days' };
    case 'last-7-days':
    default:
      return { preset, startMs: nowMs - 7 * DAY, endMs, label: 'Last 7 days' };
  }
}

export const REFLECTION_RANGE_PRESETS: readonly ReflectionRangePreset[] = [
  'today',
  'this-week',
  'last-7-days',
  'last-30-days',
];
