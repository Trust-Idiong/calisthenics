# FORM — Calisthenics

**[Open the public PWA](https://trust-idiong.github.io/calisthenics/dist/)** · [GitHub repository](https://github.com/Trust-Idiong/calisthenics) · [Privacy](https://trust-idiong.github.io/calisthenics/dist/privacy.html)

FORM is a general fitness app for ages 16 and above, with personal goals, flexible timeframes and bodyweight training. The project lives at `C:\Users\User\OneDrive\Desktop\JAHMAK\CALLISTENICS`. It grew from the original FORM_SEVEN package and keeps its workout and backup compatibility.

## Make the plan yours

Choose general fitness, strength, core control, cardio endurance, weight management, comfortable movement, consistency, or a personal performance goal. A numeric target is optional. Programs start from two weeks; the interface offers 2, 4, 8, 12, 16, 24 and 52-week presets, plus a custom target date up to ten years from the start. There is no mandatory seven-month program or fixed weight-loss target.

Personalize experience, age band (16–17, 18–49, or 50 and above), available training days, 10–60 minute sessions, coaching tone, low-impact preference, and available chair/wall support or no equipment. Optional movement preferences exclude floor work and knee-, wrist-, shoulder- or back-sensitive movements throughout the session, including preparation and recovery. When no current movement matches, the app asks you to review your preferences rather than inserting an excluded movement. These choices are general fitness filters, not an injury diagnosis or rehabilitation prescription.

Training difficulty follows ability and available equipment. Beginner sessions use gentle movements; experienced adults can use squats, push-up progressions, lunges and floor planks. Teen and older-adult plans keep gentler choices and longer recovery. Higher-impact jumping jacks require an experienced adult explicitly choosing higher-impact options. There are 20 movements: eight preserved demonstration videos and twelve written guides with links to NHS, NASM or ACE sources. The illustrations are decorative, and the app's programming has not received clinical or professional review.

Closely spaced training days include easy recovery sessions. Every fourth week is lighter, and personal performance plans ease the workload in their final week. There are no official military pass scores or required maximal-effort tests. Adult weight-loss targets are optional; aggressive loss rates and targets below the adult screening range are blocked. Weight and waist journaling are optional and are hidden for teen profiles.

## Guided workouts and recorded progress

- Personalized sessions fit the selected duration exactly, including warm-up, working windows, recovery and cool-down. Side-plank sequences give time to both sides.
- The original Foundation (10 minutes), Core & control (12 minutes), and Full-body strength (16 minutes) starter sessions remain available when they match your equipment and movement preferences.
- Timers support pause/resume, skipped intervals, ending early, sound, optional screen wake lock and additional preparation/recovery time. Partial sessions record only elapsed time. Extending intervals increases the session's duration.
- Interrupted sessions can resume paused without counting time while the app was closed. Optional effort and soreness feedback is saved; high soreness can suggest an easier subsequent session.
- General fitness and cardio goals use actual logged session and walking minutes for the current week. Session time includes preparation, rest and cool-down; it is not a claim that every minute meets a particular intensity guideline.
- Consistency counts distinct, fully completed planned workout days. Strength, core, comfortable movement and personal performance outcomes use manual assessments. Timers never invent repetition gains or hold ability. Weight progress uses recorded measurements.
- Walking logs, assessments, optional measurement charts, activity history, individual deletion, JSON backup export/restore and deliberate deletion of all local data remain available.

Legacy FORM / SEVEN v1 and v2 records migrate to the current v3 format, retaining history, custom dates and goals, measurements, walking entries and preferences. An existing target that needs review can be revised without deleting its history. Invalid or corrupt local data is protected from accidental overwrite and can be downloaded for recovery. The original portable package remains an archival download in the app.

## Install and use offline

On **Android**, open the [public app](https://trust-idiong.github.io/calisthenics/dist/) in Chrome and choose **Install app** from the app or browser menu. On **iPhone/iPad**, open it in Safari, choose **Share → Add to Home Screen**, then open the installed app.

Open the app online and wait for **Ready offline** before relying on offline use. Cached instructions, illustrations, timers, plan generation and local progress work offline. Optional videos, external source pages and the original package download require internet. App updates wait for your acceptance and are protected during active or paused workouts.

## Privacy and backups

Profiles, assessments, measurements, workout history and interrupted sessions stay in browser-local storage for this website address. The app has no account, automatic cloud sync, app analytics SDK, advertising integration or payment system. Local records and exported JSON backups are **not encrypted by FORM**. Hosting providers receive normal website requests; requesting a video connects to YouTube under its own data practices. See the [privacy page](dist/privacy.html) for the full disclosure and deletion instructions.

Browser storage can be cleared or evicted, and private browsing may retain it only temporarily. Export a backup before clearing data or changing devices, browsers or hosting addresses. Data does not automatically move between those locations. A separate Sites preview is private and has its own browser storage. Restore a backup at the intended destination to bring your history with you.

## Local development and checks

The runtime is static HTML, CSS and JavaScript; no bundling step is required. Development checks use Node.js 22+ and the locked development dependencies:

```powershell
cd 'C:\Users\User\OneDrive\Desktop\JAHMAK\CALLISTENICS'
npm ci
npm run check
node --test android-release/tooling.test.mjs
npm start
```

Open the local URL printed by the server. Modular JavaScript needs an HTTP server; direct `file://` opening is not supported. Production PWA installation requires HTTPS; localhost provides a development secure context.

The automated suites cover planner choices, exact timing, backup migration and validation, interrupted-session recovery, local storage failures, UI flows, manifests and service-worker behavior. Android tooling tests validate configuration and certificate-input handling. Passing these checks does not establish real-phone installation, video playback, accessibility across devices, Android signature validity or Play approval. Verify those on the intended devices before a store release.

## Hosting and updates

`dist/` is the complete static PWA. The public deployment is **https://trust-idiong.github.io/calisthenics/dist/**; the repository Pages root redirects to it. App paths and service-worker scope are relative so the app can also be served under another directory.

Before publishing changed app files, increment `VERSION` in [dist/sw.js](dist/sw.js), run the required checks, and publish the verified source. Preserve the existing storage keys and migration behavior so installed users retain progress. `.openai/hosting.json` records the separate Sites deployment; public distribution uses the GitHub Pages URL above.

## Android and Google Play preparation

The [Android release toolkit](android-release/README.md) provides a Trusted Web Activity configuration template, scripts for generating real-certificate Digital Asset Links and checking the host/project, and [draft store content](android-release/store-content-draft.md). The PWA remains the working product.

**No APK or signed Android App Bundle has been built, and no Play Store submission has been completed.** The toolkit still needs the owner's finalized application ID, private signing key and alias, Android SDK/JDK setup, actual Play signing certificate, origin-root asset association, device testing and Play Console release work. Its generated configuration is preparation, not an unsigned binary or a release-ready signed artifact. Keystores and passwords belong outside this repository and public hosting.

Follow the toolkit's current source links and release instructions for signing, target SDK checks, policy declarations and account-specific testing requirements. Store descriptions and privacy declarations must be reviewed against the final artifact and its real behavior.

`reference/` contains the unpacked original input for local comparison and is excluded from publication. The earlier native prototype is archived separately at `C:\Users\User\Downloads\fieldwork-native-prototype-archive`.
