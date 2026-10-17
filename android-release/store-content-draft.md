# Play listing and declarations draft

Updated October 16, 2026 for PWA version 7.0.0. Review against the final live app and Android artifact before submitting. The requested account mode uses Django/PostgreSQL, Brevo confirmation/reset email and private owner monitoring. Source is prepared; Render and production email configuration remain outstanding. No signed Android build or Play submission exists.

## Listing text

**Name:** FORM: Calisthenics

**Short description:** Bodyweight workouts, flexible goals, and progress tracking on your schedule.

**Full description draft:**

Build a home training routine that fits your life with FORM. Browse 40 workouts for full body, abs, chest, arms, core, back, glutes and legs. Filter by level and training style, save favorites and review exercise guidance before starting.

Choose from ten goals through a questionnaire showing one question at a time. Set experience, focus areas, optional body details, equipment, training days and session length, then review your actual schedule. Follow one of eight program templates with your chosen 2–52 week length, or use a personal goal and custom dates. Build your own routine, reorder or replace movements and adjust work and recovery intervals.

Adults can choose Six-pack & core strength for controlled abdominal strength practice. Its dedicated program starts at twelve weeks with a flexible length. Manual core assessments track ability; timers cannot measure visible definition or selectively remove belly fat. A six-pack result is not guaranteed.

Adults can choose Figure 8 / glutes & core for glute, core and balanced strength practice, with floor or supported standing options. Its starting program is eight weeks and the length is flexible. Optional waist/hip records can be entered independently of body weight. Assessments and measurements show personal observations; the app cannot guarantee a figure, selectively reduce waist fat or prescribe an ideal body ratio. Weight loss is not required. Either adult goal can be chosen regardless of gender; gender does not calculate exercise dose.

Adults can use pelvic-floor practice with general, men's or women's technique guidance, gentle timed lifts and full release periods. A conservative starter set and user-selected stages support comfortable practice; the app asks about suitability and current symptoms before each set. Symptoms or uncertainty lead to relaxation guidance and professional advice. It does not predict sexual stamina, generate a sexual-performance score or replace a clinician's individual exercise plan.

Follow the visual timer with warm-up, activity, recovery and cool-down. Explore 37 illustrated movements with written cues. Optional spoken exercise names use your device's browser voice service; optional video demonstrations need internet. Availability varies by device.

Review actual logged workout and walking minutes, your activity calendar, streak and duration graph. Optional rough energy estimates are available only for adults aged 19–59 after explicitly enabling them and entering age, body mass and effort. Estimates include rest, may overestimate activity and are not measured by a device or a prediction of weight change.

Set a training reminder time and days. Browser alerts require an open app. Export a training calendar and import it into your phone calendar for alerts while FORM is closed; your calendar controls permissions and delivery.

Create an email/password account and confirm the emailed link before setting up your plan. Each fresh login also requires email confirmation. When the account service is active, your profile, favorites, routines and progress sync to your account, with a separate device copy for offline work. Pending offline changes upload after reconnection and renewed access if needed; conflicts can be reviewed before replacement. The private owner dashboard receives account identity and limited training-progress records. Signup explains this storage and monitoring and asks for your agreement.

Core cached workouts and tracking can operate offline for an established profile; new login and sync need internet. Export a backup before changing hosting addresses or clearing local storage. Backups are plain files, and imported calendar events must be managed separately. The description above must not be submitted as a live account claim until the Render/Brevo deployment is verified.

FORM provides general fitness guidance for ages 16 and older; weight-loss targets, appearance-oriented plans, pelvic-floor practice and body-measurement controls are intended only for adults. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Consult a healthcare professional for medical advice, diagnosis, or treatment, and before starting if you have an injury, condition, or other concern. Exercise targets are personal goals; outcomes are not guaranteed.

**Category:** Health & Fitness (draft).

**Support:** public [repository issues](https://github.com/Trust-Idiong/calisthenics/issues); add an owner-approved support email for the Play listing. Do not copy a private Git configuration email.

**Privacy URL:** https://trust-idiong.github.io/calisthenics/dist/privacy.html — verify the deployed page before submission.

The medical disclaimer reflects Google's [Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511). This listing is a draft, and makes no claim that Google has reviewed the app.

## App content evidence

| Form/topic | Evidence to review in the final release |
| --- | --- |
| Health apps declaration | Activity and Fitness applies to guided exercise and workout logs. Declare additional categories only if the final product actually offers them; choosing a weight-related fitness goal is not a reviewed nutrition or treatment service. |
| Target audience | The app includes a 16–17 age group and adult age groups; weight-loss targets, appearance-oriented plans, pelvic-floor practice and measurement controls are for adults only. Broad levels/goals do not establish suitability for younger children, pregnancy, injury recovery or clinical populations. Owner must set the actual distribution age groups, assess requirements for minors and complete content rating. |
| App access | Email/password signup and login require confirmation of an emailed link for each fresh session. Give reviewers the final account-enabled URL and working access instructions, including the confirmation requirement. The static GitHub Pages URL has no Python service and cannot establish a real account. No paid area is implemented. |
| Ads | The app includes no advertising SDK or developer ad placements. Linked/embedded third-party video services can show their own content and must be assessed separately. |
| Permissions | No camera, microphone, location, Health Connect or body-sensor access is used. Optional browser foreground alerts ask for notification permission; the prepared TWA keeps native notification delegation off and provides no background push. Calendar export downloads a file for user import rather than requesting system-calendar access. Browser screen wake lock is optional. Confirm the generated Android manifest and device permission flow. |
| Profile and health-related entries | Goal preferences, gender, motivation, focus areas, optional birth year/height, age group, location, cardio/flexibility self-reports, desired feelings/reward, restrictions, effort/soreness/difficulty, activity, assessments, optional weight/waist/hip and estimate inputs are in the account snapshot uploaded to Django/PostgreSQL. UID-isolated, unencrypted browser copies support offline work. Favorites, custom routines, program and reminder settings also sync. Setup drafts and unfinished-session checkpoints remain device-local. Declare actual identity and health/fitness collection and its purposes rather than carrying forward earlier local-only answers. |
| Appearance-related fitness guidance | Adult Six-pack & core strength and Figure 8 / glutes & core are general strength practice with flexible dates. Manual assessments show entered ability and optional body journals show observations. No timer-derived definition, sensor measurement, ideal ratio, hourglass score, spot-fat reduction or guaranteed shape/date is claimed. Food/protein/recovery education does not provide individualized dietary treatment. Review final health declaration categories against this content. |
| Pelvic-floor practice | Adults choose general/men/women guidance separately from profile gender. Conservative lift/release sets require professional-suitability acknowledgment and fresh symptom/readiness checks. Symptoms route away from strengthening and are not saved. Technique/progression settings sync privately; completed sets contribute owner counts/minutes under the generic “Private wellness session” label, without specific routine metadata or practice settings. No sexual-performance score, symptom diary or energy estimate is produced. Review the final health/content categories for this guidance. |
| Energy estimates | Disabled by default and explicitly enabled for ages 19–59 only. Age, mass and generic effort factor are used with elapsed session time including rest. Retained figures are rough gross estimates, not sensor data or a clinical assessment. State this limitation wherever kcal totals appear. |
| Export/restore | A plain JSON backup is generated only on explicit user action and includes saved records and preferences. Users control subsequent transfers. Restore reads the selected file locally. |
| Calendar reminders | Explicit export creates a plain .ics file containing optional profile name, schedule, program/plan dates, duration and calendar alarms. The user chooses the calendar app/import. Review user-initiated transfer rules and the calendar provider's storage/sync behavior; FORM has no calendar server or closed-app delivery service. |
| Owner monitoring | Staff/superuser authorization and a verified session are enforced on the server. Owner responses show account email/name and permitted training records, excluding measurements, weigh-ins, weight targets/baselines, birth year, gender, movement restrictions, free-text notes and effort/soreness. The full private sync snapshot still exists in the database and can be accessed operationally by database/hosting administrators. Do not describe the dashboard filter as end-to-end encryption. |
| Accounts and deletion | Accounts use email/name, hashed passwords and server sessions. Confirmation tokens are hashed, time-limited and single-use. Account deletion requires the password and removes the live account/progress. Progress-only deletion retains a revision tombstone. Provide a real external deletion-request URL/contact before submission. Other-device copies, exported files, imported calendars and historical backups have separate retention/deletion needs; configure and disclose the actual policy. |
| External services | Render hosts the Django/PostgreSQL account service. Brevo receives recipient addresses and transactional message content for confirmation/reset delivery; its secret API key is server-only. HTTPS hosting sees request metadata. Requested videos connect to YouTube, and optional speech may use an online device voice provider for interval text. No microphone is used. Assess each service's actual processing and relevant Data safety rules against the deployed artifact. |
| Security | HTTPS protects transport; production sessions use HttpOnly/Secure cookies and CSRF protection. Account-bound progress requests carry the expected UID, and revision checks prevent stale overwrites. Local records, files and calendar exports have no app-level encryption. Do not claim end-to-end encryption, clinical validation or HIPAA compliance. |

Complete the [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291) in Play Console. The table is an implementation inventory, not a pre-submitted answer set.

Google's [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469) distinguishes solely on-device processing from transmitted data and separately addresses service providers and user-initiated transfers. This account mode uploads identity and full profile/progress snapshots, so earlier device-only “not collected” declarations are insufficient. Review actual purposes, sharing classifications, retention, deletion and transport for the final TWA; this draft does not pre-select Console answers.

Update the privacy page, consent flow, listing and declarations whenever deployed account behavior, analytics, ads, purchases, wearable access or hosting changes. [Account setup](../docs/authentication-setup.md) records the present architecture and unresolved Render/Brevo activation. Do not publish this draft as a verified store declaration.

## Screenshot plan

Capture genuine screens from the tested phone build and use records clearly representative of the app's operation:

1. Welcome with the original photo, Sign up/Log in forms and the email-confirmation step.
2. A question-at-a-time goal screen and final actual schedule review, showing a flexible timeframe.
3. Home and the Workouts catalog with actual body-area filters and routine cards.
4. Movement guide and custom routine builder with reorder/replace/interval controls.
5. Chosen program and guided timer showing its real schedule and interval timeline.
6. Reports with logged activity, calendar and duration graph; label any kcal total as an estimate.
7. Profile reminder controls with the open-app limitation and calendar export, plus optional estimate settings if space permits.
8. Adult pelvic-floor technique, suitability and lift/release timer, plus the adult abs and Curves plan choices.

Use screenshots from this product rather than reference-app screenshots or branding. Capture cloud sync only after the account deployment is working. Do not imply coach endorsements, sensor-measured calories, guaranteed transformations or reliable closed-app browser alerts.

Real phone screenshots are still pending. The [onboarding reference map](../docs/onboarding-reference.md) describes supplied visual references, not captured evidence that this build works on a phone. [Asset provenance](../docs/assets-provenance.md) records the original generated welcome image.
