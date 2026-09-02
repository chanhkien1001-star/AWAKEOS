# @awake-os/mobile — React Native host app (reference)

This is the thin shell that runs the engine on a device. It is **not** part of
the `npm` workspace and is not built by this repo's CI — it compiles inside a
standard React Native project. The files here are the integration you drop in.

## Create the project

```bash
npx @react-native-community/cli init AwakeOS --version latest
cd AwakeOS
npm install @awake-os/core @awake-os/app          # from this monorepo (file: or published)
npm install react-native-mmkv react-native-quick-crypto react-native-keychain
```

Add the native Event Collector module from `packages/adapters/`:

- **Android** — copy `packages/adapters/android/src` into
  `android/app/src/main/java/…`, add `AwakeEventCollectorPackage()` to
  `getPackages()`, and the `PACKAGE_USAGE_STATS` / `FOREGROUND_SERVICE` lines
  from its `AndroidManifest.xml`.
- **iOS** — add `packages/adapters/ios/AwakeEventCollector.podspec` to the
  Podfile, `pod install`.

## Wire it up

```
index.js ─▶ AwakeApp.tsx ─▶ bootstrap.ts ─▶ createAwakeRuntime({ ...platform ports })
                          │
                          ├─▶ <AwarenessWindowHost ref={presenterRef} />
                          └─▶ <ReflectionMirror now loadMirror={runtime.reflect} />
```

- `bootstrap.ts` assembles the platform ports: the native module as
  `EventSource`, `react-native-mmkv` as `StorageBackend`, a `react-native-keychain`
  key + `react-native-quick-crypto` webcrypto as the `EncryptionPort`, and the
  `AwarenessWindowHost` as the `ChoiceProvider` presenter.
- `AwakeApp.tsx` runs a low-frequency `tick()` loop (default every 15 s, and on
  `AppState` change) — the pipeline is cheap and mostly returns `NoPattern` /
  `Silence`.

## Invariant checklist for the host app

- No analytics SDK, no crash reporter that ships usage data, no network calls
  from anything under `@awake-os/*` (**I-09**).
- The key from `react-native-keychain` uses
  `ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY` and is **not** iCloud-synced.
- The Awareness Window is the only modal the engine can raise; it is always
  dismissible with a background tap (**I-08**).
- Nothing badges the app icon or sends a push to pull the user back to the
  Reflection Mirror (**I-06**).
