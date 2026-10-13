# Play listing and declarations draft

Prepared October 12, 2026. Review against the final live app and Android artifact before submitting.

## Listing text

**Name:** FORM: Calisthenics

**Short description:** Bodyweight workouts, flexible goals, and progress tracking on your schedule.

**Full description draft:**

Build a training routine that fits your life with FORM. Choose your goal, experience level, available equipment, weekly training days, and session length. Set your own program timeframe, or keep an ongoing routine.

Follow guided bodyweight sessions with warm-up, work and recovery intervals. Explore exercise cues, adapt your plan, and track completed sessions and personal milestones. Optional video demonstrations require an internet connection.

Your profile and progress stay in this browser on your device. No account is required. Core workouts and local tracking work offline after the app has finished caching. Export a backup before changing devices, browsers, or clearing local storage.

FORM provides general fitness guidance for ages 16 and older; weight-loss targets are intended only for adults. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Consult a healthcare professional for medical advice, diagnosis, or treatment, and before starting if you have an injury, condition, or other concern. Exercise targets are personal goals; outcomes are not guaranteed.

**Category:** Health & Fitness (draft).

**Support:** public [repository issues](https://github.com/Trust-Idiong/calisthenics/issues); add an owner-approved support email for the Play listing. Do not copy a private Git configuration email.

**Privacy URL:** https://trust-idiong.github.io/calisthenics/dist/privacy.html — verify the deployed page before submission.

The medical disclaimer reflects Google's [Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511). This listing is a draft, and makes no claim that Google has reviewed the app.

## App content evidence

| Form/topic | Evidence to review in the final release |
| --- | --- |
| Health apps declaration | Activity and Fitness applies to guided exercise and workout logs. Declare additional categories only if the final product actually offers them; choosing a weight-related fitness goal is not a reviewed nutrition or treatment service. |
| Target audience | The app includes a 16–17 age group and adult age groups; weight-loss targets are for adults only. Broad experience levels and goals do not establish suitability for younger children, pregnancy, injury recovery, or clinical populations. Owner must set the actual distribution age groups, assess requirements for minors, and complete content rating. |
| App access | This version has no login or paid areas. Provide Play reviewers the public URL and explain local-only onboarding. |
| Ads | The app includes no advertising SDK or developer ad placements. Linked/embedded third-party video services can show their own content and must be assessed separately. |
| Permissions | No camera, location, Health Connect, body-sensor, or notification delegation is needed. Browser screen wake lock during workouts is optional. Confirm the generated Android manifest contains only necessary permissions. |
| Local profile and health-related entries | Goal preferences, age group, safety/restriction answers, effort/soreness ratings, activity records, assessments and optional weight entries remain in unencrypted browser `localStorage`; they are not uploaded by the app. |
| Export/restore | A backup is generated only on an explicit user action and is a plain JSON file. Users control any subsequent transfer. Restoring reads a selected file locally. |
| Accounts and deletion | There are no accounts or server records. Delete all local data clears the app's records in the current browser. External backup files and other browsers/origins require separate deletion. |
| External services | HTTPS hosting sees web request metadata. Opening a YouTube demonstration connects to Google/YouTube and sends request metadata; review the final behavior, third-party terms, and Data safety exemptions instead of assuming zero data collection. |
| Security | HTTPS protects network transport. Local records/backups have no app-level encryption. Do not claim encryption at rest, clinical validation, or HIPAA compliance. |

Complete the [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291) in Play Console. The table is an implementation inventory, not a pre-submitted answer set.

Google's [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469) excludes data processed solely on the device from its collection disclosure, but separately addresses third-party code/web content and user-initiated transfers. The owner must review network behavior and relevant exceptions for the final TWA. Do not automatically mark every collection/sharing answer “No” based only on the local workout database.

If accounts, analytics, ads, cloud backup, purchases, wearable/Health Connect access, or a different hosting provider are added, update the privacy page, consent flow, listing and declarations before the release.
