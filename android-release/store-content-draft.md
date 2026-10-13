# Play listing and declarations draft

Prepared October 13, 2026 for PWA version 5.1. Review against the final live app and Android artifact before submitting.

## Listing text

**Name:** FORM: Calisthenics

**Short description:** Bodyweight workouts, flexible goals, and progress tracking on your schedule.

**Full description draft:**

Build a home training routine that fits your life with FORM. Browse 37 workouts for full body, abs, chest, arms, core, back, glutes and legs. Filter by level and training style, save favorites and review exercise guidance before starting.

Choose from nine goals, your experience level, available equipment, training days and session length. Follow one of seven program templates with your chosen 2–52 week length, or use a personal goal and custom dates. Build your own routine, reorder or replace movements and adjust work and recovery intervals.

Adults can choose Curves & glute development for glute, core and balanced strength practice, with floor or supported standing options. Its starting program is eight weeks and the length is flexible. Optional waist and hip records can be entered independently of body weight. Strength assessments and entered measurements show personal observations; the app cannot guarantee a particular figure, selectively reduce waist fat or prescribe an ideal body ratio. Weight loss is not required for this goal.

Follow the visual timer with warm-up, activity, recovery and cool-down. Explore 37 illustrated movements with written cues. Optional spoken exercise names use your device's browser voice service; optional video demonstrations need internet. Availability varies by device.

Review actual logged workout and walking minutes, your activity calendar, streak and duration graph. Optional rough energy estimates are available only for adults aged 19–59 after explicitly enabling them and entering age, body mass and effort. Estimates include rest, may overestimate activity and are not measured by a device or a prediction of weight change.

Set a training reminder time and days. Browser alerts require an open app. Export a training calendar and import it into your phone calendar for alerts while FORM is closed; your calendar controls permissions and delivery.

Your profile, favorites, routines and progress stay in this browser on your device. No account is required. Core workouts and local tracking work offline after caching completes. Export a backup before changing devices, browsers or clearing local storage. Backups are plain files; imported calendar events must be managed separately in your calendar.

FORM provides general fitness guidance for ages 16 and older; weight-loss targets, the Curves goal and body-measurement controls are intended only for adults. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Consult a healthcare professional for medical advice, diagnosis, or treatment, and before starting if you have an injury, condition, or other concern. Exercise targets are personal goals; outcomes are not guaranteed.

**Category:** Health & Fitness (draft).

**Support:** public [repository issues](https://github.com/Trust-Idiong/calisthenics/issues); add an owner-approved support email for the Play listing. Do not copy a private Git configuration email.

**Privacy URL:** https://trust-idiong.github.io/calisthenics/dist/privacy.html — verify the deployed page before submission.

The medical disclaimer reflects Google's [Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511). This listing is a draft, and makes no claim that Google has reviewed the app.

## App content evidence

| Form/topic | Evidence to review in the final release |
| --- | --- |
| Health apps declaration | Activity and Fitness applies to guided exercise and workout logs. Declare additional categories only if the final product actually offers them; choosing a weight-related fitness goal is not a reviewed nutrition or treatment service. |
| Target audience | The app includes a 16–17 age group and adult age groups; weight-loss targets, the Curves goal and measurement controls are for adults only. Broad experience levels and goals do not establish suitability for younger children, pregnancy, injury recovery or clinical populations. Owner must set the actual distribution age groups, assess requirements for minors and complete content rating. |
| App access | This version has no login or paid areas. Provide Play reviewers the public URL and explain local-only onboarding. |
| Ads | The app includes no advertising SDK or developer ad placements. Linked/embedded third-party video services can show their own content and must be assessed separately. |
| Permissions | No camera, microphone, location, Health Connect or body-sensor access is used. Optional browser foreground alerts ask for notification permission; the prepared TWA keeps native notification delegation off and provides no background push. Calendar export downloads a file for user import rather than requesting system-calendar access. Browser screen wake lock is optional. Confirm the generated Android manifest and device permission flow. |
| Local profile and health-related entries | Goal preferences, age group, safety/restriction answers, effort/soreness/difficulty ratings, activity records, assessments, optional weight/waist/hip measurements and energy-estimate settings/input snapshots remain in unencrypted browser `localStorage`; they are not uploaded by FORM. Waist/hip entries are dated and do not require weight. Favorites, custom routine names/intervals, the active program and reminder settings/last occurrence are local too. |
| Appearance-related fitness guidance | Adult Curves & glute development is general strength training with optional entered measurement trends. Manual glute-repetition assessments measure strength practice only; no sensor measurement, ideal body ratio, hourglass score, spot-fat reduction or guaranteed shape is claimed. General food/protein/recovery education does not provide individualized dietary treatment. Review the actual health declaration categories against this educational content. |
| Energy estimates | Disabled by default and explicitly enabled for ages 19–59 only. Age, mass and generic effort factor are used with elapsed session time including rest. Retained figures are rough gross estimates, not sensor data or a clinical assessment. State this limitation wherever kcal totals appear. |
| Export/restore | A plain JSON backup is generated only on explicit user action and includes saved records and preferences. Users control subsequent transfers. Restore reads the selected file locally. |
| Calendar reminders | Explicit export creates a plain .ics file containing optional profile name, schedule, program/plan dates, duration and calendar alarms. The user chooses the calendar app/import. Review user-initiated transfer rules and the calendar provider's storage/sync behavior; FORM has no calendar server or closed-app delivery service. |
| Accounts and deletion | No accounts or server records. Delete all local data removes the app's records in the current browser, including preferences and saved routines. External backups/calendar files, imported calendar events and other browsers/origins require separate deletion. |
| External services | HTTPS hosting sees request metadata. User-requested YouTube demos connect to Google/YouTube. Optional speech synthesis sends movement/interval names and durations to the browser's speech engine, which may use an online provider depending on the voice/device. No microphone or profile/health information is intentionally spoken. Review provider behavior and relevant Data safety exceptions rather than assuming zero collection. |
| Security | HTTPS protects network transport. Local records, backups and calendar exports have no app-level encryption. Do not claim encryption at rest, clinical validation or HIPAA compliance. |

Complete the [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291) in Play Console. The table is an implementation inventory, not a pre-submitted answer set.

Google's [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469) excludes data processed solely on the device from its collection disclosure, but separately addresses third-party code/web content and user-initiated transfers. The owner must review network behavior and relevant exceptions for the final TWA. Do not automatically mark every collection/sharing answer “No” based only on the local workout database.

If accounts, analytics, ads, cloud backup, purchases, wearable/Health Connect access, or a different hosting provider are added, update the privacy page, consent flow, listing and declarations before the release.

## Screenshot plan

Capture genuine screens from the tested phone build and use records clearly representative of the app's operation:

1. Discover catalog with body-area filters and actual routine cards.
2. Movement guide with original illustration and written technique cues.
3. Custom routine builder showing reorder/replace and interval controls.
4. Chosen program with its actual duration and scheduled/rest days.
5. Guided workout timer and interval timeline, with optional voice control.
6. Reports with logged activity, calendar and duration graph; label any kcal total as an estimate.
7. Profile reminder controls with the open-app limitation and calendar export, plus optional estimate preferences if space permits.

Use screenshots from this product rather than screenshots or branding copied from a reference app. Do not imply coach endorsements, sensor-measured calories, automatic cloud backup or reliable closed-app browser alerts.
