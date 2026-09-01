# @awake-os/adapters — Native Event Collectors (Step 1)

The only components that touch the OS. Their single job: **observe raw OS signals
and forward flat `RawNativeEvent` objects** across the React Native bridge into
`@awake-os/core`'s `EventCollector`. No interpretation, no derivation, no network.

## Where the pieces live

| Layer | Path | Language | Compiled/tested by |
|-------|------|----------|--------------------|
| Trust boundary — normalize + validate + de-bounce + order | `packages/core/src/ingestion/` | TypeScript | `npm test` (this repo) |
| Bridge wiring — push channel + pull backstop | `packages/app/src/ingestion/` | TypeScript | `npm test` (this repo) |
| Android observers | `packages/adapters/android/` | Kotlin | Android Studio / Gradle |
| iOS observers | `packages/adapters/ios/` | Swift | Xcode / CocoaPods |

The Kotlin/Swift here is a complete reference implementation but is **not built by
this repo** — it compiles inside a React Native host app. Everything that can be
verified without a device (the entire normalization + collection + bridging
contract) is pure TypeScript and is covered by tests.

## Data flow

```
Android BroadcastReceiver / UsageStatsManager ─┐
iOS NotificationCenter / DeviceActivity ────────┤ push  "awake:rawEventBatch"
                                                ├────────────────▶ createNativeEventSource
native RawEventBuffer  ◀── drainPendingEvents ──┘ pull  (backstop)        │
                                                                         ▼
                                                        @awake-os/core EventCollector
                                                        · normalizeEvent (I-02 / I-09 guards)
                                                        · de-bounce identical signals (I-05)
                                                        · order by occurredAt
                                                                         │
                                                                         ▼
                                                              Pipeline.tick() → Stage 2…
```

## `RawNativeEvent` (the wire shape)

Flat, all-primitive, defined in
[`packages/core/src/ingestion/raw-event.ts`](../core/src/ingestion/raw-event.ts):

```jsonc
{
  "occurredAt": 1767225600000,          // native epoch ms
  "type": "ApplicationStateChanged",
  "sourceType": "System",
  "sourceId": "android.usage-events",
  "subjectType": "Application",
  "subjectId": "sha256:s0m3-base64url",
  "payload": { "state": "Foreground", "packageNameHash": "sha256:s0m3-base64url" }
}
```

The normalizer **rejects** anything that violates:

- **I-02** — payload keys are allow-listed per type. A `windowTitle`, `url`,
  `text`, or a free-text `actionId` → `DisallowedPayloadField`.
- **I-09** — `packageNameHash` must be `sha256:<base64url>` (≥ 16 chars, no dots).
  A raw `com.instagram.android` → `UnhashedIdentifier`.
- plausible `occurredAt` (not 0, not pre-2020, not > now + 2 min).
- `schemaVersion`, if present, must be `1.0.0`.

## What each platform observes

### Android (`android/src/main/java/os/awake/collector/`)

| File | Signal | Emits |
|------|--------|-------|
| `ScreenStateReceiver.kt` | `ACTION_SCREEN_ON/OFF`, `ACTION_USER_PRESENT`, `KeyguardManager` | `ScreenStateChanged` |
| `AppUsageReader.kt` | `UsageStatsManager.queryEvents` polling (needs *Usage access*) | `ApplicationStateChanged` |
| `PackageHasher.kt` | — | salts + SHA-256s package names; salt in `EncryptedSharedPreferences` |
| `RawEventBuffer.kt` | — | bounded FIFO drained by `drainPendingEvents()` |
| `AwakeEventCollectorModule.kt` | RN `ReactContextBaseJavaModule` + `RCTDeviceEventEmitter` | the JS surface |

Grant flow: `openPermissionSettings()` opens `Settings.ACTION_USAGE_ACCESS_SETTINGS`.
Without it the collector still runs and produces screen events only —
`getStatus().permission === 'partial'`.

### iOS (`ios/AwakeEventCollector/`)

| File | Signal | Emits |
|------|--------|-------|
| `ScreenStateObserver.swift` | `protectedDataDidBecomeAvailable/Unavailable`, `UIScreen.brightnessDidChange` | `ScreenStateChanged` |
| `AppLifecycleObserver.swift` | `UIApplication` lifecycle notifications (host app only) | `ApplicationStateChanged` |
| `BundleHasher.swift` | — | salts + SHA-256s bundle ids; salt in Keychain (`…ThisDeviceOnly`) |
| `DeviceActivityBridge.swift` | Family Controls / `DeviceActivityMonitor` extension | cross-app `ApplicationStateChanged` (Step 1.1, entitlement-gated) |
| `AwakeEventCollectorModule.swift` + `.m` | RN `RCTEventEmitter` | the JS surface |

A general iOS app cannot see other apps' foreground state; cross-app visibility
needs the Family Controls entitlement, so `permission` is `'partial'` until that
extension ships.

## Host-app integration (Step 4 territory, sketch)

```ts
import { NativeModules, NativeEventEmitter } from 'react-native';
import { createEventCollector } from '@awake-os/core';
import { createNativeEventSource } from '@awake-os/app';

const native = NativeModules.AwakeEventCollector;
const emitter = new NativeEventEmitter(native);
const collector = createEventCollector({ ids: cryptoIdFactory, clock: systemClock });

const eventSource = createNativeEventSource({ native, emitter, collector });
await eventSource.start();               // asks the OS for access
const pipeline = createPipeline({ eventSource, choiceProvider, store, ids, clock });
// pipeline.tick() now pulls real device events
```

## Non-negotiables for any change here

- Emit only observed transitions + a hashed identity. Nothing else. (I-02)
- Hash package/bundle ids on-device with a per-install salt that never syncs. (I-09)
- No `INTERNET` permission on Android; no networking code on either platform. (I-09)
- Never observe our own app.
