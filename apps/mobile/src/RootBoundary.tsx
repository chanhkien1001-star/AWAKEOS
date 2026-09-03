/**
 * A last-resort error surface. A release APK shows no redbox, so any throw during
 * init would just kill the app. This renders the message + stack on screen
 * instead (local only — nothing is sent anywhere, I-09).
 */

import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

let lastGlobalError: unknown = null;

/** Record an error that happened before React mounted (e.g. in index.js). */
export function recordStartupError(e: unknown): void {
  lastGlobalError = e;
}

// Catch errors that a React boundary can't (module init, async, handlers).
const g = globalThis as unknown as {
  ErrorUtils?: { getGlobalHandler(): (e: unknown, f: boolean) => void; setGlobalHandler(h: (e: unknown, f: boolean) => void): void };
};
if (g.ErrorUtils) {
  const prev = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((e, isFatal) => {
    lastGlobalError = e;
    prev(e, isFatal);
  });
}

function format(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}\n\n${e.stack ?? ''}`;
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

export class RootBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const error = this.state.error ?? lastGlobalError;
    if (!error) return this.props.children;
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title}>AwakeOS could not start</Text>
        <Text style={styles.body} selectable>
          {format(error)}
        </Text>
      </ScrollView>
    );
  }
}
