# Orbit Launcher

Orbit is a React + Vite + Capacitor Android launcher with a native PackageManager bridge and a local Smart Auto-Tidy layout engine. Browser builds use a clearly labelled demo inventory; only Android builds query and launch installed apps.

## Web development and tests

```bash
npm ci
npm test
npm run build
```

## Build the Android debug APK

```bash
npx cap add android   # only needed if the generated android/ project does not exist
npm run patch:android
npx cap sync android
cd android
./gradlew --no-daemon assembleDebug
```

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.
The generated `android/` directory is intentionally not checked in: the Kotlin source of truth is in `android-native/`, and `scripts/patch-android-launcher.mjs` copies it, registers the plugin, and idempotently adds the HOME manifest filter after project generation. Run the patch again after regenerating the Android project.

## Android app visibility and default launcher

The native bridge queries launchable activities and exposes their package name, display label, and a cached 96px PNG icon. It launches apps only through their exported launch intents. Android package-removal broadcasts trigger a fresh inventory reconciliation; the inventory is also refreshed when Orbit returns to the foreground.

The generated manifest requests `QUERY_ALL_PACKAGES` so Android 11 and newer can expose the full launchable-app inventory required by a replacement launcher. Google Play restricts broad package visibility to approved core use cases: launcher functionality may qualify, but publishing still requires accurate Play Console declarations/review and policy approval. Do not remove the permission while claiming full launcher inventory; if Play does not approve it, narrow visibility and clearly disclose the resulting limitations.

Orbit declares `MAIN` + `HOME` + `DEFAULT` on its Android activity, while preserving Capacitor's existing `MAIN` + `LAUNCHER` filter. In the installed Android app, open **Settings → Make Orbit your Home → Open Home-app settings**, then select Orbit. Android owns the default-app choice; the app checks the PackageManager's resolved Home activity and does not assume it is selected.

## Build with GitHub Actions

The workflow `.github/workflows/build-apk.yml` runs on pushes to `main` and can also be started manually from **GitHub → Actions → Build Android APK → Run workflow**. It uses Node.js 18, Temurin Java 17, Android SDK setup v4, generates the Android project if needed, patches the native launcher integration, syncs Capacitor, and builds the debug APK.

When the run succeeds, open the run and download the `app-organizer-debug-apk` artifact. GitHub-hosted workflow artifacts are temporary (14-day retention in this workflow).

## Notes

- This workflow produces a **debug APK** for device testing, not a signed release APK for Play Store publishing.
- Required physical-device checks: choose Orbit as the Home app and verify the Home button returns to Orbit; confirm installed app labels/icons and launch actions; pin/unpin apps and restart to verify persistence; uninstall an app and confirm the broadcast/foreground refresh removes and compacts its tile; test the system settings fallback on supported Android versions.
- The hosted build can verify native compilation and manifest contents, but cannot verify device-specific default-launcher settings, package visibility policy behavior, runtime broadcasts, or launches.
- Do not commit signing keys, passwords, API secrets, or `.env` files.
