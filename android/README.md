# Fossil Hunter for Meta Quest (APK)

The Quest app is a packaged web app: a thin Android shell (made with Meta's Bubblewrap) that
opens https://meow-meow.io/trilobite/ full-window. Game updates go live through the website
deploy; the APK only needs rebuilding when the shell changes (name, icon, app mode, version).

- Package: `io.meowmeow.fossilhunter`
- Mode: `2D` (a window in the Quest home with the game's own "Enter VR" button). Switch to
  `immersive` in `make-twa.mjs` once the game launches straight into WebXR.
- Signing key: `~/.config/fossil-hunter/android.keystore`, passwords in `signing.env` beside it.
  **Back these up.** Every update to an installed or listed app must be signed with the same key.
- Digital Asset Links: `https://meow-meow.io/.well-known/assetlinks.json` (copy of
  `assetlinks.json` here) proves the app and site belong together. Without it the app shows a
  browser bar, and an immersive app won't launch.

## Rebuild

```bash
cd android
npm install                     # Bubblewrap CLI, locally
node make-twa.mjs               # twa-manifest.json from the live web manifest
npx bubblewrap update --skipVersionUpgrade
set -a; . ~/.config/fossil-hunter/signing.env; set +a
npx bubblewrap build --skipPwaValidation
```

Bump `appVersionCode` (and `appVersionName`) in `make-twa.mjs` for every new upload.
Toolchain: `~/.bubblewrap/config.json` points at a JDK 17 in `~/.bubblewrap/` and an SDK shim
(`~/.bubblewrap/sdk-shim`, links into `~/Android/Sdk`, which needs build-tools 34.0.0).

## Install

- **Your own headset (developer mode on):** plug it in, allow USB debugging, then
  `adb install -r app-release-signed.apk`. It appears under **Unknown Sources** in the library.
- **Friends without developer mode:** add them as testers on a release channel in the Meta
  Developer Dashboard (below); they install it from the store like any app.

## Horizon Store

1. developers.meta.com/horizon → create an organisation and an app, choosing **Meta Horizon
   Store** and the **PWA** type (uploads fail validation if the app isn't set up as a PWA).
2. Upload `app-release-signed.apk` to the **ALPHA** release channel (dashboard upload, or
   `ovr-platform-util upload-quest-build --app-id … --app-secret … --apk app-release-signed.apk --channel ALPHA`).
3. Release channels → ALPHA → add testers by the email on their Meta account.
4. The full store listing (art, descriptions, age rating, privacy policy) comes later.
