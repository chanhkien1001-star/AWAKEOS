/**
 * THE 13 SYSTEM INVARIANTS — Product Constitution.
 *
 * These are rules that cannot be broken by code, architecture, or UI. This file
 * is the machine-readable copy plus the runtime guards that other modules call.
 * If a guard throws, the build/PR is wrong — do not "handle" the error, fix the
 * caller.
 */

export type InvariantId =
  | 'I-01' | 'I-02' | 'I-03' | 'I-04' | 'I-05' | 'I-06' | 'I-07'
  | 'I-08' | 'I-09' | 'I-10' | 'I-11' | 'I-12' | 'I-13';

export interface Invariant {
  readonly id: InvariantId;
  readonly title: string;
  readonly statement: string;
}

export const INVARIANTS: readonly Invariant[] = Object.freeze([
  { id: 'I-01', title: 'Agency Above Compliance',
    statement: 'Optimize for conscious choice, not user obedience to recommendations.' },
  { id: 'I-02', title: 'Evidence Before Interpretation',
    statement: 'Observe behavior only. Never infer internal mental/emotional states without explicit user confirmation.' },
  { id: 'I-03', title: 'Human Meaning Sovereignty',
    statement: 'Only the human can define the meaning/intent of their experience.' },
  { id: 'I-04', title: 'Silence Is a Valid Action',
    statement: 'System silence is a first-class outcome, not an engine failure.' },
  { id: 'I-05', title: 'Minimum Necessary Intervention',
    statement: 'Minimize frequency, duration, cognitive load, and interruption intensity.' },
  { id: 'I-06', title: 'No Dependency Replacement',
    statement: 'The product must never replace one digital dependency with a new dependency on this app.' },
  { id: 'I-07', title: 'Reflection, Not Judgment',
    statement: 'Make objective behavioral structures visible; never label the person or behavior as good, bad, addicted, or compulsive.' },
  { id: 'I-08', title: 'Reversibility of Intervention',
    statement: 'Every intervention must be instantly dismissible, escapable, or reversible.' },
  { id: 'I-09', title: 'Local-First Data Sovereignty',
    statement: 'Default processing is 100% on-device. The user retains absolute control over data sync.' },
  { id: 'I-10', title: 'No Hidden Manipulation',
    statement: 'Dark patterns, variable rewards, artificial urgency, shame, guilt, or fear are strictly forbidden.' },
  { id: 'I-11', title: 'Structural Naming Only',
    statement: 'Naming of concepts must reflect objective structure, not presumed meaning.' },
  { id: 'I-12', title: 'Non-Coercive Transparency',
    statement: 'Do not disguise interventions as neutral observations. Transparently state why an Awareness Window was opened.' },
  { id: 'I-13', title: 'Choice Symmetry',
    statement: 'Do not structurally, visually, or interactively privilege one valid user choice over another.' },
]);

export class InvariantViolation extends Error {
  readonly invariant: InvariantId;
  constructor(invariant: InvariantId, detail: string) {
    super(`[${invariant}] ${detail}`);
    this.name = 'InvariantViolation';
    this.invariant = invariant;
  }
}

/**
 * Words that assert meaning, pathology, or a verdict about a person. Forbidden in
 * structural names (I-11) and in any user-facing intervention / reflection text
 * (I-07, I-10, I-12).
 */
export const INTERPRETIVE_LEXICON: readonly string[] = Object.freeze([
  'doomscroll', 'doomscrolling', 'addict', 'addicted', 'addiction', 'compulsive',
  'compulsion', 'obsessive', 'craving', 'withdrawal', 'relapse', 'binge',
  'anxiety', 'anxious', 'stress', 'stressed', 'depressed', 'depression',
  'lonely', 'bored', 'boredom', 'distracted', 'distraction', 'wasting',
  'wasted', 'unhealthy', 'toxic', 'bad habit', 'good habit', 'guilt', 'shame',
  'lazy', 'weak', 'failure', 'should', 'must stop',
]);

/** Coercive / dark-pattern phrasing forbidden in user-facing copy (I-10, I-12, I-13). */
export const COERCIVE_LEXICON: readonly string[] = Object.freeze([
  'are you sure', 'you sure', "don't leave", 'do not leave', 'wait!',
  'last chance', 'hurry', 'act now', "you'll regret", 'only now',
  'just one more', 'keep going', 'come back', 'we miss you', 'streak',
  'you earned', 'reward', 'congratulations', 'well done', 'good job',
]);

function containsFrom(haystack: string, lexicon: readonly string[]): string | null {
  const h = haystack.toLowerCase();
  for (const term of lexicon) if (h.includes(term)) return term;
  return null;
}

/**
 * I-11 / I-07 — a Pattern.structuralName (or any concept name) must describe
 * structure, not meaning. Also rejects spaces: structural names are identifiers.
 */
export function assertStructuralName(name: string): void {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
    throw new InvariantViolation('I-11', `structural name must be a bare identifier, got ${JSON.stringify(name)}`);
  }
  const hit = containsFrom(name, INTERPRETIVE_LEXICON);
  if (hit) {
    throw new InvariantViolation('I-11', `structural name contains interpretive term "${hit}": ${JSON.stringify(name)}`);
  }
}

/**
 * I-12 / I-10 / I-07 — user-facing intervention & reflection copy must be
 * transparent and non-coercive: no verdicts, no pressure, no shame, no rewards.
 */
export function assertNonCoerciveText(text: string): void {
  const interp = containsFrom(text, INTERPRETIVE_LEXICON);
  if (interp) throw new InvariantViolation('I-12', `user-facing text contains interpretive term "${interp}"`);
  const coerce = containsFrom(text, COERCIVE_LEXICON);
  if (coerce) throw new InvariantViolation('I-10', `user-facing text contains coercive phrasing "${coerce}"`);
}

/** Keys that would turn a mirror into a scoreboard. Forbidden by I-07. */
const JUDGMENT_KEYS: readonly string[] = Object.freeze([
  'score', 'healthScore', 'wellbeingScore', 'addictionIndex', 'riskLevel',
  'rating', 'grade', 'streak', 'points', 'xp', 'level', 'rank', 'badge',
  'goalProgress', 'verdict', 'diagnosis',
]);

/** I-07 — a ReflectionMirror (or any object shown as a "mirror") carries facts only. */
export function assertNoJudgment(obj: unknown, path = 'reflection'): void {
  if (obj === null || typeof obj !== 'object') return;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (JUDGMENT_KEYS.some((k) => k.toLowerCase() === key.toLowerCase())) {
      throw new InvariantViolation('I-07', `judgment-shaped key "${key}" at ${path}`);
    }
    if (typeof value === 'string') {
      const hit = containsFrom(value, INTERPRETIVE_LEXICON);
      if (hit) throw new InvariantViolation('I-07', `interpretive term "${hit}" in ${path}.${key}`);
    }
    if (value && typeof value === 'object') assertNoJudgment(value, `${path}.${key}`);
  }
}

/**
 * A visual/interactive weight descriptor for one choice control. Every field that
 * could bias the eye or the thumb toward one option lives here.
 */
export interface ChoiceWeight {
  readonly fontSizePx: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly backgroundOpacity: number;
  readonly animationMs: number;
  readonly autoFocused: boolean;
  readonly order: number;
}

/**
 * I-13 — every choice presented in one Awareness Window must have symmetrical
 * weight. Differences allowed only in: label, `order`, and the action fired.
 */
export function assertChoiceSymmetry(weights: readonly ChoiceWeight[]): void {
  if (weights.length < 2) return;
  const [first, ...rest] = weights as [ChoiceWeight, ...ChoiceWeight[]];
  const dims = (w: ChoiceWeight) =>
    [w.fontSizePx, w.widthPx, w.heightPx, w.backgroundOpacity, w.animationMs].join('|');
  for (const w of rest) {
    if (dims(w) !== dims(first)) {
      throw new InvariantViolation('I-13', `choice controls differ in visual weight: ${dims(first)} vs ${dims(w)}`);
    }
  }
  if (weights.some((w) => w.autoFocused)) {
    throw new InvariantViolation('I-13', 'no choice control may be auto-focused / default-highlighted');
  }
}

/** I-08 — an intervention modality must be escapable in a single gesture. */
export function assertReversible(spec: { readonly dismissible: boolean; readonly blocksInput: boolean }): void {
  if (!spec.dismissible) throw new InvariantViolation('I-08', 'intervention is not dismissible');
  if (spec.blocksInput) throw new InvariantViolation('I-08', 'intervention hard-blocks input (not escapable)');
}
