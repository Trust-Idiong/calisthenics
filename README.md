# FORM — Calisthenics

**[Open the public PWA](https://trust-idiong.github.io/calisthenics/dist/)** · [GitHub repository](https://github.com/Trust-Idiong/calisthenics) · [Privacy](https://trust-idiong.github.io/calisthenics/dist/privacy.html)

FORM is a home fitness app for ages 16 and above, with a workout catalog, flexible goals, custom routines and local progress reports. The project lives at `C:\Users\User\OneDrive\Desktop\JAHMAK\CALLISTENICS`. Version 5 expands the original FORM_SEVEN foundation and preserves its workout history and backup compatibility.

## Find a workout and make the plan yours

Discover **33 routines across eight body areas**: full body, abs, chest, arms, core, back, glutes and legs. Search by name and filter by area, experience level or style: strength, cardio, interval training, calisthenics, weight-management activity, warm-up, stretching and recovery. Save favorites and view each routine's movement list, duration and requirements before starting. A routine that conflicts with your preferences explains why it is unavailable.

Six structured program templates begin with four-week schedules. Choose your own **2–52 week** program length and training days, then use the scheduled day cards and next-session action. Closely spaced training days can include recovery sessions; every fourth week is lighter. Difficulty feedback and soreness can adjust working and recovery windows within the selected level. Program completion uses fully completed, scheduled days belonging to that program instance.

Personal goals remain independent of the program templates. Choose general fitness, strength, core control, cardio endurance, weight management, comfortable movement, consistency or a personal performance goal. A numeric target is optional. Personal plans start from two weeks, with 2, 4, 8, 12, 16, 24 and 52-week presets and a custom target date up to ten years from the start. There is no mandatory seven-month program or fixed weight-loss target.

Personalize experience, age band (16–17, 18–49 or 50 and above), training days, guidance tone, low-impact preference, chair/wall support or no equipment. Personal sessions use 10–60 minutes; catalog routines can use 5–60 minutes. Movement preferences can exclude floor work and knee-, wrist-, shoulder- or back-sensitive movements throughout preparation, activity and recovery. When no available movement matches, the app asks you to review your preferences. These are general fitness filters, not an injury diagnosis or rehabilitation prescription.

Beginner sessions use gentle movements. Experienced adults can select harder push-up and plank variations; teen and older-adult plans keep gentler choices and longer recovery. Higher-impact movements require an experienced adult explicitly choosing those options. Adult weight-loss targets are optional; aggressive loss rates and targets below the adult screening range are blocked. Weight and waist journaling are optional and hidden for teen profiles. The app does not provide official military pass scores or require maximal-effort testing.

## Your routines and guided sessions

- Build and name a routine, add or replace movements, reorder them, and set working seconds, recovery seconds, repetitions of an interval, warm-up and cool-down. Edit or delete saved routines; deleting a routine retains its recorded past activity.
- Explore **32 movements**, each with an original illustration and written cues. Ten optional video demonstrations include the eight original videos and two additional NASM guides; 22 movements use text guides with source links. Artwork is illustrative, and the programming has not received clinical or professional review.
- Follow a visual interval timeline and timer with preparation, activity, recovery and cool-down. Optional spoken movement names and durations use the browser's speech service; voice availability and offline support depend on the device and selected voice. Guidance does not imply expert endorsement.
- Personalized and catalog sessions fit the requested duration exactly. Custom routine duration follows its configured intervals. Side-plank sequences give time to both sides.
- Pause/resume, skip an interval, finish early, toggle sound, use optional screen wake lock, or extend preparation/recovery. Partial sessions record elapsed time only; extensions increase the total duration.
- Restore an interrupted session paused, with its saved movement sequence, without counting the time the app was closed. Record optional effort, soreness and difficulty feedback after a session.

The original Foundation (10 minutes), Core & control (12 minutes) and Full-body strength (16 minutes) starter workouts remain available when they match your movement preferences.

## Reports and optional energy estimates

View logged workout counts, actual session and walking minutes, an activity streak, a monthly activity calendar and a recent daily-duration graph. Report periods include this week, this month and all recorded activity. Calendar marks distinguish fully completed sessions from other logged activity; partial sessions never become completed workouts merely because time elapsed.

Personal goals use appropriate records: general fitness and cardio use actual logged time, consistency uses distinct completed scheduled days, strength/core/comfortable movement/performance use manual assessments, and weight progress uses recorded measurements. Timers do not invent repetition gains or hold ability. Session minutes include preparation, rest and cool-down, and do not imply that every minute meets an intensity guideline.

**Energy estimates are off by default.** Adults aged **19–59** can explicitly enable a rough gross-session kcal estimate after entering age, body mass and a light/moderate/vigorous effort choice. The generic factors are 2.8, 3.8 and 7.5 MET from the [2024 Adult Compendium's calisthenics entries](https://pacompendium.com/conditioning-exercise/); its [adult age scope](https://pacompendium.com/adult-compendium/) and [unit conversion](https://pacompendium.com/unite-conversions/) provide the reference. The implementation calculates `round(MET × 3.5 × mass_kg / 200 × elapsed_minutes)`.

This applies one self-selected effort factor to the entire elapsed session, **including rest**, and can overestimate activity. It is not measured expenditure, an individualized metabolic model, or a prediction of weight change. Completed records keep their original estimate, input mass/age and MET snapshot; changing settings does not recalculate earlier history. Sessions without an estimate are not treated as measured zero-calorie activity. Teen profiles and ages outside 19–59 cannot enable this feature.

## Reminders

Choose reminder weekdays and a local time in Profile. In-app reminders operate while the page is open; browser/device notification behavior varies. The app does not schedule server push or promise alerts after it closes.

Export the **training calendar (.ics)** and import it into a phone calendar for alerts while FORM is closed. The file includes scheduled times, the plan/program date range, a session duration and optional profile name, with calendar alarms. The calendar app controls alert permission, delivery and any calendar-cloud sync. Changing reminder settings, switching off reminders or deleting FORM data does **not** remove an already imported calendar event; remove it separately in that calendar. Re-importing edited schedules may create duplicate events, so review existing entries.

## Install, offline use and backups

On **Android**, open the [public app](https://trust-idiong.github.io/calisthenics/dist/) in Chrome and choose **Install app** from the app or browser menu. On **iPhone/iPad**, open it in Safari and choose **Share → Add to Home Screen**.

Open online and wait for **Ready offline** before relying on offline use. Cached routines, instructions, illustrations, timers, plan generation and local reports work offline. Optional videos, external source pages and the original package download need internet. Spoken cues may need internet depending on the device's voice provider. Updates wait for your acceptance and are protected during active or paused sessions.

Profiles, assessments, measurements, workout history, favorites, custom routines, program status, reminder settings and estimate settings stay in browser-local storage for this website address. There is no account, automatic cloud sync, app analytics SDK, advertising integration or payment system. Local records, JSON backups and calendar exports are **not encrypted by FORM**. Hosting sees ordinary web requests; requested videos and device speech services have their own data practices. See the [privacy page](dist/privacy.html).

Export a backup before clearing data or changing devices, browsers or hosting addresses. Browser storage can be cleared or evicted; private browsing may retain it only temporarily. Data does not automatically move between those locations. A separate Sites preview is private and uses its own origin storage. Restore a backup at the intended destination to bring your records with you.

Legacy FORM / SEVEN v1, v2 and v3 records migrate to **state format v4**, retaining history, custom dates and goals, measurements, walking entries and preferences. Invalid or corrupt records are protected from accidental overwrite and can be downloaded for recovery. Current backups also preserve new saved routines, favorites, program and settings. An existing target can be revised without erasing its history. The original portable package is an archival download in the app.

## Local development and checks

The runtime is static HTML, CSS and JavaScript; no bundling step is required. Development checks use Node.js 22+ and the locked development dependencies:

```powershell
cd 'C:\Users\User\OneDrive\Desktop\JAHMAK\CALLISTENICS'
npm ci
npm run check
npm start
```

Open the local URL printed by the server. Modular JavaScript needs HTTP serving; direct `file://` opening is not supported. Production PWA installation requires HTTPS, while localhost provides a development secure context.

The checks syntax-validate all runtime modules and Android helpers, then run the automated suites, including Android tooling tests. Coverage includes planner and catalog choices, custom interval timing, programs, backup migration, recovery, reports, reminders/calendar serialization, estimate bounds, storage failures, UI flows, manifests and service-worker behavior. Passing does not establish real-phone installation, calendar alarm delivery, speech availability, video playback, accessibility across devices, Android signature validity or Play approval. Verify those on the intended devices.

## Hosting and Android release preparation

`dist/` is the complete PWA. The public deployment remains **https://trust-idiong.github.io/calisthenics/dist/**; the repository Pages root redirects there. App paths and service-worker scope are relative. Before publishing changes, increment `VERSION` in [dist/sw.js](dist/sw.js), run the required checks and publish the verified source. Preserve storage keys and migrations for installed users. `.openai/hosting.json` records the separate Sites deployment.

The [Android release toolkit](android-release/README.md) includes a Trusted Web Activity template, scripts for real-certificate Digital Asset Links and host/project checks, and [draft store content](android-release/store-content-draft.md).

**No APK or signed Android App Bundle has been built, and no Play Store submission has been completed.** The toolkit needs the owner's finalized application ID, private signing key and alias, Android SDK/JDK, actual Play signing certificate, origin-root association, device testing and Play Console release work. Configuration is preparation, not a release artifact. Keep keys and passwords outside this repository and public hosting. Review store and privacy declarations against the final artifact and real network behavior, including optional speech and calendar exports.

`reference/` contains the original input for local comparison and is excluded from publication. The earlier native prototype is archived at `C:\Users\User\Downloads\fieldwork-native-prototype-archive`.
