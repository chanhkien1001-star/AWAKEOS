/**
 * The Usage Access permission ask. Structural, optional, reversible — the copy
 * is checked with `assertNonCoerciveText` and states plainly that the app works
 * without it (I-08 / I-12).
 */

import { assertNonCoerciveText } from '@awake-os/core';
import type { CollectorPermission } from '../ingestion/native-module.ts';

export type UsageAccessState = CollectorPermission | 'unknown';

export interface UsageAccessRequestCopy {
  readonly title: string;
  readonly body: string;
  readonly grantLabel: string;
  readonly skipLabel: string;
  /** Shown after returning from settings, whatever the outcome. */
  readonly afterReturn: string;
}

const COPY: UsageAccessRequestCopy = {
  title: 'Usage access (optional)',
  body:
    'To notice when you move between apps, Android asks you to grant "Usage access" in system settings. The app uses it only to see that a foreground app changed, and when. It never reads app content. Without it, the app runs on screen signals alone.',
  grantLabel: 'Open settings',
  skipLabel: 'Not now',
  afterReturn: 'You can change this any time in Settings > Usage access.',
};

for (const line of [COPY.title, COPY.body, COPY.grantLabel, COPY.skipLabel, COPY.afterReturn]) {
  assertNonCoerciveText(line);
}

export function describeUsageAccessRequest(): UsageAccessRequestCopy {
  return COPY;
}

/** True when the collector reported cross-app visibility is available. */
export function hasFullUsageAccess(state: UsageAccessState): boolean {
  return state === 'granted';
}

/** A short, neutral status line for the settings screen. */
export function usageAccessStatusLine(state: UsageAccessState): string {
  switch (state) {
    case 'granted':
      return 'Granted — app changes are observed.';
    case 'partial':
      return 'Not granted — running on screen signals only.';
    case 'denied':
      return 'Declined — running on screen signals only.';
    case 'restricted':
      return 'Blocked by device policy — running on screen signals only.';
    default:
      return 'Status unknown.';
  }
}
