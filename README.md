# FORM / SEVEN — Calisthenics PWA

Standalone project at `C:\Users\User\OneDrive\Desktop\JAHMAK\CALLISTENICS`, based on the user's FORM_SEVEN_Package.zip. It has no dependency on Silsilad. The PWA is the primary product; future native apps can build on these data and workout modules.

## Features preserved

- Foundation (10 minutes), Core & control (12), and Full-body strength (16) with automatic work/rest, warm-up/cool-down, pause/resume, skipping, elapsed time, sound, screen wake lock and keyboard shortcut.
- Warm-up extension to six minutes, extra warm-up/cool-down minutes and extra recovery intervals; partial sessions log actual activity time.
- Exercise videos with attribution and original links, offline illustrations/form cues, search and movement filters.
- Personal starting weight, start/target dates, loss target, seven-month phases, weekly strength/recovery rhythm and guidance sources.
- Distinct strength days and brisk-walking weekly targets; easy/brisk walk logging.
- Weight and optional waist measurements, trend chart, goal progress, training/activity history and deletion.
- JSON backup export/restore, legacy v1 migration, retained custom targets and same-date waist values.
- Download of the original portable package, with its local launchers.

## PWA additions

Phone-readable controls and safe-area navigation; manifest and home-screen icons; Android/Desktop installation and iPhone/iPad instructions; atomic offline app-shell caching; online/offline readiness; consent-based updates protected during active or paused sessions; optional persistent browser storage.

Unfinished workouts are checkpointed locally and can be resumed **paused**, without counting time while the app was closed. Corrupt saved data is protected from accidental overwrite, with original-data download, restore and deliberate reset. Backup validation rejects ambiguous duplicate IDs/dates. Saving failures are displayed honestly.

Workout instructions, timers and locally saved progress work offline after the offline copy has finished preparing. Videos and external guidance require internet and are never cached by the app. Browser storage can still be cleared by the browser or operating system; export backups regularly. Data does not synchronize across browsers, phone and desktop or between different hosting origins. To bring previous history, export it from the old app and restore that JSON in this app.

## Develop and verify

No dependencies or build step are required. Node.js 22+:

```powershell
npm test
npm start
```

Open the local URL printed by the server. Serve `dist/` over HTTPS for production installation (localhost is also a secure development context). Do not open the modular app directly with `file://`.

## Hosting

The GitHub repository is [Trust-Idiong/calisthenics](https://github.com/Trust-Idiong/calisthenics). `dist/` is the complete static app; `.openai/hosting.json` identifies its Sites deployment. Paths and service-worker scope are relative and also support GitHub Pages at `/calisthenics/`.

To update a deployed PWA, bump `VERSION` in `dist/sw.js`, run all tests, publish the unchanged verified source, and let users accept the update when their workout is finished. Offline updates preserve the progress storage key and backup format.

## Install on your phone

- **iPhone/iPad:** open the live app in Safari, tap Share, then **Add to Home Screen**. Open it once while online and wait for **Ready offline**.
- **Android:** open in Chrome, choose **Install app** in the app or browser menu, then wait for **Ready offline**.

## Verification limits

All 37 engine, checkpoint, storage, manifest and service-worker tests passed. JavaScript syntax checks passed, and all local app-shell resources and the original package download returned HTTP 200 with correct content types. The connected preview browser was unavailable in this session; real phone layout, browser installation and third-party video playback require device verification. This is a general fitness tool, with the original package's health guidance and sources retained; it does not provide medical diagnosis or guarantee a fitness outcome.

`reference/` contains the unpacked input for local comparison and is excluded from Git/publication. The earlier native prototype was archived outside Silsilad at `C:\Users\User\Downloads\fieldwork-native-prototype-archive`.
