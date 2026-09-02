# @awake-os/mobile — React Native host app

The device shell that runs the engine. It is a **standalone project** (not part
of the repo's npm workspace) and is not built by CI.

**To build it: see [`SETUP.md`](SETUP.md)** — `npm install`, generate the Gradle
wrapper, `npm run android`.

## Layout

```
index.js                AppRegistry entry -> src/AwakeApp
app.json                { "name": "AwakeOS" }
src/
  AwakeApp.tsx          routes loading -> onboarding -> usage-access -> main / settings
  bootstrap.ts          wires native module + MMKV + Keychain key + quick-crypto -> AwakeRuntimeDeps
  OnboardingScreen.tsx  first-run explainer (copy from @awake-os/app, guarded non-coercive)
  UsageAccessScreen.tsx optional Usage Access request; opens system settings
  SettingsScreen.tsx    windows on/off, rest periods, observed apps, retention, erase-all
android/                full Gradle project (wrapper jar added in SETUP.md)
  app/src/main/java/os/awake/collector/   the Kotlin Event Collector (from packages/adapters)
```

## Data flow on device

```
Kotlin AwakeEventCollector ──native module──▶ createNativeEventSource
react-native-mmkv ─────────────────────────▶ StorageBackend
Keychain key + quick-crypto webcrypto ─────▶ EncryptionPort (AES-256-GCM)
AwarenessWindowHost ───────────────────────▶ ChoiceProvider
                                            └▶ createAwakeRuntime → tick() every 15s
```

## Invariant checklist for this host

- Release `AndroidManifest.xml` has **no `INTERNET`** permission; Metro's is in
  `app/src/debug/` only (**I-09**). No analytics / crash SDK.
- `data_extraction_rules.xml` excludes everything from cloud backup & device
  transfer.
- The storage key uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, never iCloud/Drive.
- The Awareness Window is the only modal the engine raises; always dismissible
  with a background tap (**I-08**).
- No app-icon badge, no push to pull the user back to the Reflection Mirror
  (**I-06**).
