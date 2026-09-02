# apps/mobile — one-time setup to a buildable Android project

The whole project tree is here **except three files that are binary or
version-generated** and cannot live in this text repo. Two commands fill them.

## Prerequisites

- **Node ≥ 18**, **JDK 17** (Temurin), **Android Studio** with:
  SDK Platform **34**, Build-Tools **34.0.0**, NDK **26.1.10909125**,
  and an emulator or a phone with USB debugging.
- Set `ANDROID_HOME` (e.g. `C:\Users\<you>\AppData\Local\Android\Sdk`).

## Step 1 — install JS deps

```bash
cd apps/mobile
npm install
```

This links `@awake-os/core` and `@awake-os/app` from `../../packages/*` (via the
`file:` deps) and installs `react-native`, `react-native-mmkv`,
`react-native-quick-crypto`, `react-native-keychain`.

## Step 2 — generate the Gradle wrapper (the missing binary)

`android/gradle/wrapper/gradle-wrapper.jar`, `android/gradlew`,
`android/gradlew.bat` are not committed. Get them one of these ways:

- **Android Studio** — "Open" the `apps/mobile/android` folder; it detects the
  missing wrapper and offers to create it. Accept. Done.
- **Gradle CLI** — if `gradle` is installed
  (`winget install Gradle.Gradle` / `choco install gradle` / SDKMAN):
  ```bash
  cd apps/mobile/android
  gradle wrapper --gradle-version 8.10.2 --distribution-type all
  ```
- **Copy from a fresh template**:
  ```bash
  npx @react-native-community/cli init _tmp --version 0.75.4 --skip-install --directory _tmp
  cp -r _tmp/android/gradle apps/mobile/android/
  cp _tmp/android/gradlew _tmp/android/gradlew.bat apps/mobile/android/
  rm -rf _tmp
  ```

## Step 3 — the debug keystore (for `npm run android`)

```bash
cd apps/mobile/android/app
keytool -genkeypair -v -storetype PKCS12 -keystore debug.keystore \
  -alias androiddebugkey -storepass android -keypass android \
  -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
```

(Or copy `~/.android/debug.keystore` if you already have one and point
`signingConfigs.debug.storeFile` at it.)

## Step 4 — run

```bash
cd apps/mobile
npm start           # Metro, in one terminal
npm run android     # build + install on the connected device/emulator
```

On the phone, complete onboarding, then **Settings → Usage access → AwakeOS →
Allow** (or use the in-app "Open settings" button).

## Release build

See [`../../docs/RELEASE.md`](../../docs/RELEASE.md). Short version, once the
upload keystore + `~/.gradle/gradle.properties` are set:

```bash
cd apps/mobile
npm run build:aab   # -> android/app/build/outputs/bundle/release/app-release.aab
```

## What's already here

```
apps/mobile/
├── index.js, app.json, package.json, metro.config.js, babel.config.js, tsconfig.json
├── src/                     AwakeApp + Onboarding/UsageAccess/Settings screens + bootstrap
└── android/
    ├── build.gradle, settings.gradle, gradle.properties
    ├── gradle/wrapper/gradle-wrapper.properties   (jar added in Step 2)
    └── app/
        ├── build.gradle, proguard-rules.pro
        └── src/
            ├── main/AndroidManifest.xml           (no INTERNET; Usage Access declared)
            ├── debug/AndroidManifest.xml          (INTERNET for Metro only)
            ├── main/java/com/awakeos/             MainActivity.kt, MainApplication.kt
            ├── main/java/os/awake/collector/      the Event Collector native module
            └── main/res/                          strings, styles, adaptive launcher icon
```
