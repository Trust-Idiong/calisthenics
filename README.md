# FORM — Calisthenics

**[Open the public PWA](https://trust-idiong.github.io/calisthenics/dist/)** · [GitHub repository](https://github.com/Trust-Idiong/calisthenics) · [Privacy](https://trust-idiong.github.io/calisthenics/dist/privacy.html)

FORM is a home fitness app for ages 16 and above, with a workout catalog, flexible goals, custom routines and local progress reports. The project lives at `C:\Users\User\OneDrive\Desktop\JAHMAK\CALLISTENICS`. Version 6 adds a welcome screen, device profiles, a questionnaire showing one question at a time, and a compact Home screen while preserving the original FORM_SEVEN workout history and backup compatibility.

## Welcome and personal setup

**Device-only profiles are the chosen current mode.** On welcome, **LET'S GO** enters gender/setup directly; **Your device profile** opens the saved local profile with a continue/create-plan action. No cloud account, password or authentication-service setup is needed. The app does not describe this local profile as an authenticated cloud account.

The questionnaire uses four chapters: Goal, Know your body, Workout preference and Fitness assessment. It asks about gender (including Others and Prefer not to answer), motivation, one of nine goals, focus areas, optional adult height/weight and weight target, optional birth year and age group, timeframe, training location, weekdays, movement exclusions, equipment, session length, experience, self-reported cardio/flexibility comfort, desired feelings, a personal reward, optional name/assessment target, guidance and a final schedule review. Back navigation and a local draft let users review answers and resume unfinished setup. The final action saves the reviewed plan; it does not promise a physical result on the selected date.

Returning profiles and migrated workout records skip mandatory setup. Training preferences can be edited through the same questionnaire. Gender, motivation, feelings and rewards personalize the profile; ability, age group, time, equipment and movement preferences determine training choices. Location is a preference, and does not grant access to equipment the user has not selected. Self-reported comfort is not a clinical fitness test. Body measurements, birth year and numeric outcome targets are optional.

Home shows the greeting, actual completed training days, the personal next-workout entry, an unfinished-session entry when available, and routes to Workouts, My plan and Reports. Workouts, Programs, My workouts and For you provide focused views of the existing catalog and saved content.

See the [reference screen map](docs/onboarding-reference.md) for the screenshot-to-feature mapping and [asset provenance](docs/assets-provenance.md) for the original welcome photo. A [future account adapter](docs/authentication-setup.md) is retained as inactive source preparation; it is not part of the current device-only product and does not block this release.

## Find a workout and make the plan yours

Discover **37 routines across eight body areas**: full body, abs, chest, arms, core, back, glutes and legs. Search by name and filter by area, experience level or style: strength, cardio, interval training, calisthenics, weight-management activity, warm-up, stretching and recovery. Save favorites and view each routine's movement list, duration and requirements before starting. A routine that conflicts with your preferences explains why it is unavailable.

Seven structured program templates include six four-week schedules and an eight-week Curves & glute development starting plan. Choose your own **2–52 week** program length and training days, then use the scheduled day cards and next-session action. Closely spaced training days can include recovery sessions; every fourth week is lighter. Difficulty feedback and soreness can adjust working and recovery windows within the selected level. Program completion uses fully completed, scheduled days belonging to that program instance.

Personal goals remain independent of the program templates. Choose general fitness, strength, core control, cardio endurance, weight management, comfortable movement, consistency, a personal performance goal, or adult Curves & glute development. A numeric target is optional. Personal plans start from two weeks, with 2, 4, 8, 12, 24 and 52-week setup presets and a custom target date up to ten years from the start. There is no mandatory seven-month program or fixed weight-loss target.

Personalize experience, setup age group (16–17, 18–64 or 65+), training days, guidance tone, low-impact preference, chair/wall support or no equipment. An optional birth year sets an approximate age group; legacy age-group preferences remain intact during migration. Personal sessions use 10–60 minutes; catalog routines can use 5–60 minutes. Movement preferences can exclude floor work and knee-, wrist-, shoulder- or back-sensitive movements throughout preparation, activity and recovery. When no available movement matches, the app asks you to review your preferences. These are general fitness filters, not an injury diagnosis or rehabilitation prescription.

Beginner sessions use gentle movements. Experienced adults can select harder push-up and plank variations; teen and older-adult plans keep gentler choices and longer recovery. Higher-impact movements require an experienced adult explicitly choosing those options. Adult weight-loss targets are optional; aggressive loss rates and targets below the adult screening range are blocked. Weight, waist and hip journaling are optional and hidden for teen profiles. The app does not provide official military pass scores or require maximal-effort testing.

## Curves & glute development

This adult goal supports women seeking glute development through glute, core and balanced strength practice. Floor routines can use no equipment; standing alternatives use chair support, with harder options for eligible intermediate adults. Your equipment and movement preferences still apply. The program defaults to eight weeks and can be changed to 2–52 weeks.

Log optional **waist and hip measurements in centimetres independently of body weight**. History and trends show only what you entered. A manual glute-repetition assessment tracks strength practice; it does not score appearance or infer muscle size. Shape and circumference changes vary between people, and a particular “figure eight” or hourglass result cannot be guaranteed. Abdominal exercise cannot selectively remove waist fat, as explained in [ACE's discussion of spot reduction](https://www.acefitness.org/resources/everyone/blog/6273/3-fat-loss-myths-to-stop-believing-now/).

The app offers general education about progressive challenge, adequate food/protein and recovery, with [ACSM's 2026 resistance-training guidance](https://acsm.org/resistance-training-guidelines-update-2026/) and [ACE's glute exercise discussion](https://www.acefitness.org/resources/pros/expert-articles/8807/strength-training-the-glutes-an-evidence-based-approach/) as references for training. Weight loss is not a prerequisite, and no individualized meal plan, crash diet or ideal waist-to-hip ratio is prescribed. The Curves goal and body-measurement controls are for adults; teen users can choose general strength, movement and consistency goals.

## Your routines and guided sessions

- Build and name a routine, add or replace movements, reorder them, and set working seconds, recovery seconds, repetitions of an interval, warm-up and cool-down. Edit or delete saved routines; deleting a routine retains its recorded past activity.
- Explore **37 movements**, each with an original illustration and written cues. Ten optional video demonstrations include the eight original videos and two additional NASM guides; 27 movements use text guides with source links. Artwork is illustrative, and the programming has not received clinical or professional review.
- Follow a visual interval timeline and timer with preparation, activity, recovery and cool-down. Optional spoken movement names and durations use the browser's speech service; voice availability and offline support depend on the device and selected voice. Guidance does not imply expert endorsement.
- Personalized and catalog sessions fit the requested duration exactly. Custom routine duration follows its configured intervals. Side-plank sequences give time to both sides.
- Pause/resume, skip an interval, finish early, toggle sound, use optional screen wake lock, or extend preparation/recovery. Partial sessions record elapsed time only; extensions increase the total duration.
- Restore an interrupted session paused, with its saved movement sequence, without counting the time the app was closed. Record optional effort, soreness and difficulty feedback after a session.

The original Foundation (10 minutes), Core & control (12 minutes) and Full-body strength (16 minutes) starter workouts remain available when they match your movement preferences.

## Reports and optional energy estimates

View logged workout counts, actual session and walking minutes, an activity streak, a monthly activity calendar and a recent daily-duration graph. Report periods include this week, this month and all recorded activity. Calendar marks distinguish fully completed sessions from other logged activity; partial sessions never become completed workouts merely because time elapsed.

Personal goals use appropriate records: general fitness and cardio use actual logged time, consistency uses distinct completed scheduled days, strength/core/comfortable movement/performance/Curves use manual strength or ability assessments, and weight progress uses recorded measurements. Timers do not invent repetition gains or hold ability. Session minutes include preparation, rest and cool-down, and do not imply that every minute meets an intensity guideline.

**Energy estimates are off by default.** Adults aged **19–59** can explicitly enable a rough gross-session kcal estimate after entering age, body mass and a light/moderate/vigorous effort choice. The generic factors are 2.8, 3.8 and 7.5 MET from the [2024 Adult Compendium's calisthenics entries](https://pacompendium.com/conditioning-exercise/); its [adult age scope](https://pacompendium.com/adult-compendium/) and [unit conversion](https://pacompendium.com/unite-conversions/) provide the reference. The implementation calculates `round(MET × 3.5 × mass_kg / 200 × elapsed_minutes)`.

This applies one self-selected effort factor to the entire elapsed session, **including rest**, and can overestimate activity. It is not measured expenditure, an individualized metabolic model, or a prediction of weight change. Completed records keep their original estimate, input mass/age and MET snapshot; changing settings does not recalculate earlier history. Sessions without an estimate are not treated as measured zero-calorie activity. Teen profiles and ages outside 19–59 cannot enable this feature.

## Reminders

Choose reminder weekdays and a local time in Profile. In-app reminders operate while the page is open; browser/device notification behavior varies. The app does not schedule server push or promise alerts after it closes.

Export the **training calendar (.ics)** and import it into a phone calendar for alerts while FORM is closed. The file includes scheduled times, the plan/program date range, a session duration and optional profile name, with calendar alarms. The calendar app controls alert permission, delivery and any calendar-cloud sync. Changing reminder settings, switching off reminders or deleting FORM data does **not** remove an already imported calendar event; remove it separately in that calendar. Re-importing edited schedules may create duplicate events, so review existing entries.

## Install, offline use and backups

On **Android**, open the [public app](https://trust-idiong.github.io/calisthenics/dist/) in Chrome and choose **Install app** from the app or browser menu. On **iPhone/iPad**, open it in Safari and choose **Share → Add to Home Screen**.

Open online and wait for **Ready offline** before relying on offline use. Cached routines, instructions, illustrations, timers, plan generation and local reports work offline. Optional videos, external source pages and the original package download need internet. Spoken cues may need internet depending on the device's voice provider. Updates wait for your acceptance and are protected during active or paused sessions.

Profiles, setup drafts, assessments, measurements, workout history, favorites, custom routines, program status, reminder settings and estimate settings stay in browser-local storage for this website address. The current device-only app has no connected account provider or training-cloud sync, app analytics SDK, advertising integration or payment system. Prepared future account support separates Firebase UID-local records from the device namespace, but is inactive and would not synchronize training by itself. Local records, JSON backups and calendar exports are **not encrypted by FORM**. Hosting sees ordinary web requests; requested videos and device speech services have their own data practices. See the [privacy page](dist/privacy.html).

Export a backup before clearing data or changing devices, browsers or hosting addresses. Browser storage can be cleared or evicted; private browsing may retain it only temporarily. Data does not automatically move between those locations. A separate Sites preview is private and uses its own origin storage. Restore a backup at the intended destination to bring your records with you.

Legacy FORM / SEVEN v1, v2 and v3 records migrate to **state format v4**, retaining history, custom dates and goals, measurements, walking entries and preferences. The optional `bodyMeasurements` collection adds date-based waist/hip entries without requiring weight; older backups without that field load normally. Invalid or corrupt records are protected from accidental overwrite and can be downloaded for recovery. Current backups also preserve saved routines, favorites, program and settings. An existing target can be revised without erasing its history. The original portable package is an archival download in the app.

## Local development and checks

The runtime is static HTML, CSS and JavaScript; no bundling step is required. Development checks use Node.js 22+ and the locked development dependencies:

```powershell
cd 'C:\Users\User\OneDrive\Desktop\JAHMAK\CALLISTENICS'
npm ci
npm run check
npm start
```

Open the local URL printed by the server. Modular JavaScript needs HTTP serving; direct `file://` opening is not supported. Production PWA installation requires HTTPS, while localhost provides a development secure context.

The checks syntax-validate runtime modules and helpers, then run the automated suites, including Android tooling tests. Coverage includes questionnaire state/navigation, device-profile and Home routing, planner/catalog choices, custom timing, programs, backup migration, recovery, reports, reminders/calendar serialization, estimate bounds, storage failures, manifests and service-worker behavior. Separate future-auth tests use a test SDK substitute and do not establish live connectivity. Passing does not establish real-phone installation, calendar alarm delivery, speech availability, video playback, accessibility across devices, Android signature validity or Play approval. Verify those on the intended devices; connecting real accounts would require its own provider checks in a future release.

## Hosting and Android release preparation

`dist/` is the complete PWA. The public deployment remains **https://trust-idiong.github.io/calisthenics/dist/**; the repository Pages root redirects there. App paths and service-worker scope are relative. Before publishing changes, increment `VERSION` in [dist/sw.js](dist/sw.js), run the required checks and publish the verified source. Preserve storage keys and migrations for installed users. `.openai/hosting.json` records the separate Sites deployment.

The [Android release toolkit](android-release/README.md) includes a Trusted Web Activity template, scripts for real-certificate Digital Asset Links and host/project checks, and [draft store content](android-release/store-content-draft.md).

**No APK or signed Android App Bundle has been built, and no Play Store submission has been completed.** The toolkit needs the owner's finalized application ID, private signing key and alias, Android SDK/JDK, actual Play signing certificate, origin-root association, device testing and Play Console release work. Configuration is preparation, not a release artifact. Keep keys and passwords outside this repository and public hosting. Review store and privacy declarations against the final artifact and real network behavior, including optional speech and calendar exports.

`reference/` contains the original input for local comparison and is excluded from publication. The earlier native prototype is archived at `C:\Users\User\Downloads\fieldwork-native-prototype-archive`.
