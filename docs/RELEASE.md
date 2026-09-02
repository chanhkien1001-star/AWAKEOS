# Release guide — publishing AwakeOS to Google Play

This is the full path from the current repo (engine + reference wiring) to an app
on the Play Store. Legend: **[you]** = only you can do it; **[me]** = generated
in this repo; **[both]** = I scaffold, you run.

Realistic timeline: **3–6 weeks**, dominated by the mandatory 14-day closed test
and Google's review of the Usage Access permission.

---

## Part A — one-time account & key setup  **[you]**

1. **Play Developer account** — https://play.google.com/console — $25 one-time,
   identity verification (government ID), 1–3 business days. Personal accounts now
   require a **closed test with ≥12 testers for 14 continuous days** before
   production access is unlocked.

2. **Host the privacy policy.** Enable GitHub Pages on this repo (Settings →
   Pages → deploy from `main`, `/docs`). Your policy URL becomes
   `https://<user>.github.io/AWAKEOS/PRIVACY` (rendered from `docs/PRIVACY.md`).
   You need this URL for the store listing and the Data safety form.

3. **Generate the upload keystore** (keep it forever, never commit it):

   ```bash
   keytool -genkeypair -v -keystore awake-upload.jks -alias awake-upload \
     -keyalg RSA -keysize 4096 -validity 10000
   ```

   Store `awake-upload.jks`, the store password, and the key password in a
   password manager. Enrol in **Play App Signing** when you create the app (Google
   holds the real signing key; you only manage the upload key).

---

## Part B — turn the repo into a runnable Android app  **[both]**

The engine (`@awake-os/core`, `@awake-os/app`) is done and tested. What's missing
is the React Native host project.

1. On a machine with **JDK 17** + **Android Studio** (SDK Platform 35,
   Build-Tools, an emulator or a USB-debugging phone):

   ```bash
   npx @react-native-community/cli init AwakeOS --pm npm
   cd AwakeOS
   ```

2. Add the engine (from a local checkout of this repo, or publish the two
   packages privately):

   ```bash
   npm i ../AWAKE-OS/packages/core ../AWAKE-OS/packages/app   # file: deps
   npm i react-native-mmkv react-native-quick-crypto react-native-keychain
   ```

3. Copy in the app files from this repo's `apps/mobile/src/` (`bootstrap.ts`,
   `AwakeApp.tsx`, and the onboarding / settings / permission screens) and
   replace `index.js`.

4. **Integrate the native Event Collector** (`packages/adapters/android/`):
   - copy `src/main/java/os/awake/collector/*` into
     `android/app/src/main/java/os/awake/collector/`;
   - register it — in `MainApplication.kt` `getPackages()` add
     `add(AwakeEventCollectorPackage())`;
   - merge the `<uses-permission>` lines from
     `packages/adapters/android/src/main/AndroidManifest.xml` into
     `android/app/src/main/AndroidManifest.xml`;
   - add `androidx.security:security-crypto` and the kotlinx-coroutines dep to
     `android/app/build.gradle`.

5. `npm run android` on a connected device. On the phone: **Settings → Usage
   access → AwakeOS → Allow** (or the app's in-built prompt).

---

## Part C — signed release bundle  **[both]**

`android/gradle.properties` (do **not** commit real values — use `~/.gradle/`
or CI secrets):

```properties
AWAKE_UPLOAD_STORE_FILE=awake-upload.jks
AWAKE_UPLOAD_KEY_ALIAS=awake-upload
AWAKE_UPLOAD_STORE_PASSWORD=***
AWAKE_UPLOAD_KEY_PASSWORD=***
```

`android/app/build.gradle` → `android { signingConfigs { release { ... } }
buildTypes { release { signingConfig signingConfigs.release; minifyEnabled true } } }`
reading those properties.

Build the **App Bundle** (Play requires `.aab`, not `.apk`):

```bash
cd android && ./gradlew bundleRelease
# -> android/app/build/outputs/bundle/release/app-release.aab
```

### CI alternative (no Android Studio) — GitHub Actions

Add secrets: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 awake-upload.jks`),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

```yaml
name: android-release
on: { workflow_dispatch: {} }
jobs:
  aab:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: apps/mobile } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: "17" }
      - run: npm ci
      - run: echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > android/app/awake-upload.jks
      - run: cd android && ./gradlew bundleRelease
        env:
          AWAKE_UPLOAD_STORE_FILE: awake-upload.jks
          AWAKE_UPLOAD_STORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          AWAKE_UPLOAD_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          AWAKE_UPLOAD_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
      - uses: actions/upload-artifact@v4
        with: { name: app-release-aab, path: apps/mobile/android/app/build/outputs/bundle/release/app-release.aab }
```

You still need Part B done once so `apps/mobile/` is a real project with an
`android/` folder.

---

## Part D — Play Console  **[you]**

1. **Create app** → enrol in Play App Signing.
2. **Store listing** — name, descriptions (say: on-device, no account, no ads,
   minimal dismissible prompts, *not* a screen-time blocker), icon 512×512,
   feature graphic 1024×500, ≥2 screenshots. Privacy policy URL from Part A.
3. **App content** — Data safety, content rating, target audience, ads
   (declare **none**), government-app (no). Use the answers in
   [`PLAY-PERMISSIONS.md`](PLAY-PERMISSIONS.md).
4. **Permissions Declaration** for `PACKAGE_USAGE_STATS` — paste the
   justification from `PLAY-PERMISSIONS.md`. Expect a possible follow-up email;
   reply promptly.
5. **Testing → Internal testing** — upload the `.aab`, add your own devices,
   verify it installs and the permission flow works.
6. **Testing → Closed testing** — create a track, add ≥12 testers (real Google
   accounts), run it **14 consecutive days**. This is a hard gate for personal
   accounts.
7. **Production** — after the closed test, submit for review (days to ~2 weeks
   for a sensitive-permission app). Roll out.

---

## What is NOT ready yet

- `apps/mobile/` has only wiring files — no `android/` project (Part B step 1).
- No onboarding, no settings screen (rest periods, observed-apps opt-in,
  "erase all data"), no permission-request UI, no app icon.
- These are the next things to build in this repo; the engine underneath them is
  complete.
