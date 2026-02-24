# Portarium Cockpit — Mobile Release Rollout Playbook

> Bead: bead-0723
> Applies to: iOS (App Store) and Android (Google Play) releases of Portarium Cockpit.

---

## Overview

Portarium Cockpit is distributed as:

| Track   | Artifact              | Channel                     |
| ------- | --------------------- | --------------------------- |
| PWA     | `apps/cockpit/dist/`  | HTTPS via CDN               |
| iOS     | `App.xcarchive` → IPA | TestFlight → App Store      |
| Android | `app-release.aab`     | Internal track → Play Store |

Native builds are a Capacitor wrapper around the same React SPA. Every native release must pass the CI gate (`cockpit-mobile-ci.yml`) before promotion.

---

## Pre-release checklist

- [ ] `main` branch is green (CI + `cockpit-mobile-ci.yml`).
- [ ] Version bumped in `apps/cockpit/package.json` (`version` field).
- [ ] Native build numbers incremented:
  - iOS: `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`
  - Android: `versionCode` in `android/app/build.gradle`
- [ ] `npx cap sync` run after any web build change (`dist/` must be current).
- [ ] `CHANGELOG.md` entry added.
- [ ] VAPID public key set in CI secrets (`VITE_VAPID_PUBLIC_KEY`).
- [ ] Deep-link universal link file reachable: `https://portarium.io/.well-known/apple-app-site-association`.

---

## iOS release

### 1. Build

```bash
cd apps/cockpit
npm run build          # produces dist/
npx cap sync ios       # copies dist/ + plugins into ios/

# Open Xcode
npx cap open ios
```

In Xcode:

- Set scheme to **App**, target to **Any iOS Device**.
- Product → Archive.

### 2. Distribute to TestFlight

- Xcode Organizer → Distribute App → App Store Connect → Upload.
- Wait for processing (typically 15–30 min).
- Add internal testers in App Store Connect → TestFlight.

### 3. Smoke test on TestFlight

Run through the [smoke test checklist](#smoke-test-checklist) on at least:

- iPhone (iOS 15, minimum supported)
- iPhone (iOS 17, latest)

### 4. App Store submission

- Attach screenshots (6.7", 5.5", iPad 12.9" if applicable).
- Fill in "What's New" from `CHANGELOG.md`.
- Submit for review. Typical review time: 24–48 h.

### 5. Staged rollout

- Start at **10%** of users.
- Monitor crash rate in Xcode Organizer → Crashes.
- If crash-free rate > 99.5% after 24 h, increase to 50%, then 100%.
- If crash rate spikes: pause rollout immediately (App Store Connect → phased release → Pause).

---

## Android release

### 1. Build

```bash
cd apps/cockpit
npm run build
npx cap sync android

cd android
./gradlew bundleRelease   # produces app-release.aab (requires keystore)
```

Keystore is managed via CI secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, etc.). For local builds, configure `android/app/build.gradle` signing config.

### 2. Internal testing track

- Upload `app-release.aab` to Google Play Console → Internal testing.
- Install via internal track on test devices.
- Run [smoke test checklist](#smoke-test-checklist).

### 3. Production rollout

- Promote to Production with **10% rollout**.
- Monitor ANR rate and crash rate in Android Vitals.
- Target: crash-free sessions > 99.5%, ANR rate < 0.47% (Play Store threshold).
- After 24 h without regressions: increase to 50%, then 100%.
- If regressions: halt rollout and issue hotfix build.

---

## Smoke test checklist

Run on both iOS and Android (simulator/emulator acceptable for non-push items):

### Auth

- [ ] Cold launch → login screen appears
- [ ] OIDC PKCE login completes and returns to app
- [ ] JWT claims extracted (sub, email, tenant, roles)
- [ ] Silent token refresh works after 1 h (or mock expiry)
- [ ] Logout clears stored tokens

### Push notifications

- [ ] Push permission prompt appears on first launch
- [ ] Device token registered to backend (`POST /api/notifications/device-tokens`)
- [ ] Foreground notification renders title + body
- [ ] Notification tap opens correct in-app route

### Core navigation

- [ ] Operations Map loads
- [ ] Approval queue loads
- [ ] Active run detail page loads
- [ ] Deep link `portarium://app/runs/{id}` routes correctly

### Native capabilities

- [ ] Haptic feedback on primary actions
- [ ] Clipboard write works
- [ ] Status bar style correct (dark icons on light background)
- [ ] Splash screen appears and dismisses correctly

### Offline resilience

- [ ] App shell loads when offline (PWA cache)
- [ ] Network error state shown for data fetches
- [ ] App recovers gracefully when connectivity restored

---

## Rollback procedure

### iOS

1. In App Store Connect → phased release → **Pause** (stops new downloads from getting the version).
2. If critical: submit an expedited review for the fixed build, or request App Store removal and re-release.

### Android

1. Play Console → Halt rollout (immediately stops further device updates).
2. If urgent: use the "Roll back" button to revert to the previous production build.

### Backend compatibility

- All API changes must be backward-compatible for at least two release cycles.
- If a breaking change is needed: use API versioning (`/v2/`) and keep `/v1/` alive until old mobile versions drop below 5% install share.

---

## CI integration

The `cockpit-mobile-ci.yml` workflow runs on every PR touching `apps/cockpit/`:

| Job             | Runs on       | What it checks               |
| --------------- | ------------- | ---------------------------- |
| `web-build`     | ubuntu-latest | `vite build` succeeds        |
| `ios-build`     | macos-14      | Xcode simulator build        |
| `android-build` | ubuntu-latest | Gradle debug APK             |
| `smoke-tests`   | ubuntu-latest | 19 unit-level smoke tests    |
| `mobile-ci-ok`  | ubuntu-latest | Required gate (blocks merge) |

iOS and Android native builds are gated on `workflow_dispatch` or PR, and upload build artifacts for inspection.

---

## Environment secrets required

| Secret                    | Used by                              |
| ------------------------- | ------------------------------------ |
| `VITE_VAPID_PUBLIC_KEY`   | Web push subscription (CI build env) |
| `ANDROID_KEYSTORE_BASE64` | Release signing (CD workflow)        |
| `ANDROID_KEY_ALIAS`       | Release signing                      |
| `ANDROID_KEY_PASSWORD`    | Release signing                      |
| `ANDROID_STORE_PASSWORD`  | Release signing                      |
| `APPLE_API_KEY_ID`        | Fastlane App Store Connect upload    |
| `APPLE_API_ISSUER_ID`     | Fastlane                             |
| `APPLE_API_PRIVATE_KEY`   | Fastlane                             |
