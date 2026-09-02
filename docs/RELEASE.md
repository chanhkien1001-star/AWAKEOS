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

## Part B — the Android app  **[both]**

The full RN project already lives in [`apps/mobile/`](../apps/mobile) — screens,
`android/` Gradle project, native Event Collector, manifest (no `INTERNET` in
release), adaptive icon. Only the Gradle wrapper **jar** (binary) is missing.

Follow [`apps/mobile/SETUP.md`](../apps/mobile/SETUP.md):

1. `cd apps/mobile && npm install`
2. Generate the wrapper: open `apps/mobile/android` in Android Studio (it offers
   to), or `cd android && gradle wrapper --gradle-version 8.10.2`.
3. Create `android/app/debug.keystore` (command in SETUP.md).
4. `npm start` + `npm run android` on a device/emulator.
5. On the phone: **Settings → Usage access → AwakeOS → Allow** (or the in-app
   button).

Toolchain: **JDK 17**, Android Studio with SDK Platform **34**, Build-Tools
**34.0.0**, NDK **26.1.10909125**. `minSdk` is 29.

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

### CI — two workflows

- **`.github/workflows/android-apk.yml`** (`android-apk`) — already in the repo.
  Manual run (`workflow_dispatch`) or on a `v*` tag. Builds a **debug-signed,
  unshrunk, JS-bundled release APK** and uploads it as `awakeos-test-apk`. For
  device testing / sharing with testers — **not** for Play.

- **Play `.aab`** — add a second workflow when your upload keystore exists. Add
  secrets `ANDROID_KEYSTORE_BASE64` (`base64 -w0 awake-upload.jks`),
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, then
  the same steps as `android-apk.yml` but ending with:

  ```yaml
      - run: echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > apps/mobile/android/app/awake-upload.jks
      - working-directory: apps/mobile/android
        run: ./gradlew bundleRelease --no-daemon
        env:
          AWAKE_UPLOAD_STORE_FILE: awake-upload.jks
          AWAKE_UPLOAD_STORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          AWAKE_UPLOAD_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          AWAKE_UPLOAD_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
      - uses: actions/upload-artifact@v4
        with: { name: app-release-aab, path: apps/mobile/android/app/build/outputs/bundle/release/app-release.aab }
  ```

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

- The Gradle wrapper **jar** is not committed (binary) — 1 command, see
  `apps/mobile/SETUP.md`.
- The Play Store **listing icon** (512×512 PNG) and feature graphic must be
  authored — the in-app launcher icon is a vector adaptive icon and is done.
  See `apps/mobile/assets/README.md`.
- The settings "observed apps" allow-list has no app-picker UI yet (defaults to
  "observe all"; the consent filter itself works).
- Everything else — engine, screens, native module, manifest, signing config —
  is in place and tested.
