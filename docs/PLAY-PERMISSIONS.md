# Google Play — permissions & Data safety answers

Copy these into the Play Console forms. Adjust wording to match the final app,
but keep every claim true (Google audits sensitive-permission apps).

---

## 1. Permissions Declaration — `PACKAGE_USAGE_STATS` (Usage Access)

**Which permission:** `android.permission.PACKAGE_USAGE_STATS` (special access,
granted by the user in Settings → Usage access).

**Is it core to the app's functionality?** Yes.

**Core use case:** Human Agency OS is a digital-wellbeing / awareness tool. It
observes *when* the foreground application changes so it can, on the device,
detect structural patterns (e.g. an unusually long continuous session for this
user) and — rarely — show a brief, dismissible "Awareness Window" prompting a
conscious choice to continue or stop. Without Usage Access it cannot tell that
the user has been in one app for a long time and the feature does not function.

**What data is accessed:** Only `UsageEvents` of type MOVE_TO_FOREGROUND /
MOVE_TO_BACKGROUND and their timestamps. The package name is hashed on-device
immediately (salted SHA-256); the readable name is never stored.

**Data handling:** 100% on-device. No network permission is declared. No usage
data is transmitted, sold, or shared. Data is encrypted at rest and auto-deleted
on a retention schedule.

**Alternatives considered:** `AccessibilityService` would expose far more (screen
content) and is not appropriate. Usage Access is the minimum API that provides
foreground-app transitions.

**User control:** The permission is optional at first run; the app degrades to
screen-only signals without it. It can be revoked at any time in system settings.

---

## 2. Data safety form

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** — data is processed on-device only and never leaves it. |
| Is all user data encrypted in transit? | N/A — no data is transmitted. |
| Do you provide a way for users to request that their data be deleted? | **Yes** — "Erase all data" in-app, and uninstalling removes everything. |
| Data processed ephemerally? | Some (event stream), but most is stored locally (encrypted). Declare **"Data is processed on this device only"** for every applicable type. |

If the form forces you to name data types for the on-device processing, use:

- **App activity → App interactions** — *Processed on device only. Not
  collected. Not shared.* Purpose: App functionality. Optional.
- Nothing else.

---

## 3. Foreground service (if the UsageStats poller runs as one)

If you keep `AppUsageReader` alive with a foreground service, declare
`FOREGROUND_SERVICE_SPECIAL_USE` with subtype and a short justification:
"Periodically reads UsageStats to detect foreground-app transitions for an
on-device digital-wellbeing feature." Prefer `WorkManager` periodic work or
running only while the app is in the foreground to avoid this entirely.

---

## 4. Content rating

Questionnaire answers: no violence, no sexual content, no profanity, no
controlled substances, no gambling, no user-generated content, no data sharing.
Expected rating: **Everyone / PEGI 3**.

## 5. Target audience & content

Target age: 18+ (or 13+). Not designed for children. No ads.

## 6. Store listing checklist

- App name, short (80 char) + full (4000 char) description — emphasise: on-device,
  no account, no ads, minimal and dismissible prompts, not a screen-time blocker.
- App icon 512×512, feature graphic 1024×500, ≥2 phone screenshots.
- Privacy policy URL → the hosted `docs/PRIVACY.md`.
- Category: **Health & Fitness** (or Lifestyle).
