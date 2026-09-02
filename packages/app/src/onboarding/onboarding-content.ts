/**
 * Onboarding copy. Every string is run through `assertNonCoerciveText` at module
 * load — if a future edit sneaks in a shaming or pressuring phrase, the app
 * fails fast (I-10 / I-12). The framing is deliberate: this is not a screen-time
 * blocker and it does not diagnose anyone (I-02 / I-07).
 */

import { assertNonCoerciveText } from '@awake-os/core';

export interface OnboardingStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

const STEPS: readonly OnboardingStep[] = [
  {
    id: 'what',
    title: 'A pause, not a wall',
    body:
      'This app watches only the structure of how you use your phone — when the screen turns on, when an app comes to the foreground. Once in a while it opens a short window that asks you to choose: continue, or stop. Both are fine.',
  },
  {
    id: 'not',
    title: 'What it is not',
    body:
      'It does not block apps, count your minutes, or tell you that anything is wrong. It never reads what is on your screen. It makes no judgment about you.',
  },
  {
    id: 'onDevice',
    title: 'It stays on your device',
    body:
      'There is no account and no server. Everything is processed and stored on this device, encrypted. You can shorten how long data is kept, or erase all of it, in settings at any time.',
  },
  {
    id: 'permission',
    title: 'One optional permission',
    body:
      'To notice when you switch apps, the app can use the system "Usage access" permission. It is used for that and nothing else. If you skip it, the app still works using screen signals only.',
  },
  {
    id: 'choice',
    title: 'You decide the meaning',
    body:
      'When a window opens it will state plainly what it observed. What that means, and what to do about it, is yours to decide. You can turn windows off entirely and keep only the reflection view.',
  },
];

for (const step of STEPS) {
  assertNonCoerciveText(step.title);
  assertNonCoerciveText(step.body);
}

export const ONBOARDING_STEPS = STEPS;
