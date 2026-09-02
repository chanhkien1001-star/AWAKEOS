# Privacy Policy — Human Agency OS (AwakeOS)

_Last updated: 2026-09-02_

Human Agency OS ("the app") is built on a simple promise: **your usage data
never leaves your device.**

## What the app observes

To open an Awareness Window at a well-placed moment, the app observes a small set
of **structural** signals from the operating system:

- **Screen state** — on / off / locked / unlocked transitions, with timestamps.
- **Foreground application changes** — that an app moved to the foreground or
  background, and *when*. The app's package name is immediately replaced with a
  salted one-way hash (SHA-256) on your device; the readable package name is
  never stored.
- **Explicit inputs you choose to share** — for example, a scroll or a tap,
  recorded only as a short pre-defined action code and a timestamp.

The app **does not** read, collect, or store: the content of any screen, app,
notification, or message; window or page titles; URLs; text you type; your
contacts; your location; your photos; your microphone or camera; or your
identity.

## Where your data goes

**Nowhere.** All processing happens on your device. The app:

- makes **no network requests** of any kind (the Android build does not request
  the `INTERNET` permission);
- contains **no analytics, crash-reporting, advertising, or third-party SDKs**
  that transmit data;
- stores everything in the app's private sandbox, **encrypted at rest**
  (AES-256-GCM) with a key held only in your device's hardware keystore.

There is no account, no sign-in, and no server operated by us.

## How long data is kept

The app automatically deletes old data on a schedule (default: raw events after
30 days, derived structural summaries after ~6 months, your saved reflections
after ~12 months). You can shorten these in settings, and you can erase
**all** app data at any time from the settings screen or by uninstalling.

## The "Usage Access" permission

To detect foreground-application changes, Android requires the special
**Usage Access** permission (`PACKAGE_USAGE_STATS`). The app uses it for the
single purpose above — deriving structural usage patterns on your device — and
for nothing else. If you do not grant it, the app still works using screen
signals only. You can revoke it any time in **Settings → Usage access**.

## Your rights

Because no data leaves your device, there is nothing for us to hold, sell, or
disclose. You have full control: view, shorten retention, or delete everything
locally.

## Children

The app is not directed at children under 13 and collects no personal
information from anyone.

## Changes

Any change to this policy will be published at this URL with a new date.

## Contact

chanhkien1001@gmail.com
