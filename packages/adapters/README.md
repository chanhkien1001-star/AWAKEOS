# @awake-os/adapters — Native Event Collectors

**Implementation Step 1.** These are the only components allowed to touch the OS.
Their single job: observe raw OS signals and emit normalized `Event` objects
(schema `1.0.0`) across the bridge into `@awake-os/core`'s `EventSource` port.

## Hard rules

- **I-02 Evidence Before Interpretation** — emit only what was observed:
  screen on/off/lock/unlock, app foreground/background/terminated, explicit user
  inputs the user opted to share. Never emit a guessed state ("focused",
  "distracted", "restless").
- **I-09 Local-First** — an adapter never sends an Event anywhere except the
  local bridge. No network calls, ever.
- **`packageNameHash`** — the raw package / bundle id must be salted-hashed on
  device before it leaves the adapter. The salt is per-install, stored in the
  platform keystore, never synced.
- **No PII in payloads** — no window titles, URLs, notification text, clipboard,
  keystrokes. `ExplicitInputReceived.actionId` is an app-defined enum, not free
  text.

## Event shape the bridge expects

```jsonc
{
  "id": "uuid-v4",
  "occurredAt": 1735820000000,            // Unix epoch UTC ms
  "type": "ApplicationStateChanged",
  "source": { "type": "System", "id": "android.usage-events" },
  "subject": { "type": "Application", "id": "sha256:base64url(salt+pkg)" },
  "payload": { "state": "Foreground", "packageNameHash": "sha256:base64url(salt+pkg)" },
  "schemaVersion": "1.0.0"
}
```

## Files

| Platform | Signal source | Skeleton |
|----------|---------------|----------|
| Android  | `UsageStatsManager` / `UsageEvents`, `ACTION_SCREEN_ON/OFF`, `KeyguardManager` | [`android/ScreenStateAdapter.kt`](android/ScreenStateAdapter.kt), [`android/ApplicationStateAdapter.kt`](android/ApplicationStateAdapter.kt) |
| iOS      | `UIApplication` lifecycle notifications, `UIScreen`, screen-time entitlements | [`ios/ScreenStateAdapter.swift`](ios/ScreenStateAdapter.swift), [`ios/ApplicationStateAdapter.swift`](ios/ApplicationStateAdapter.swift) |

Each adapter exposes one method to the JS bridge: `drainPendingEvents(): Event[]`,
consumed by a `NativeEventSource implements EventSource` in `@awake-os/app`.
