# FORM Android release preparation

The working product is the PWA. This folder prepares its later Android release through a Trusted Web Activity (TWA): an Android launcher opens the owned HTTPS app through a supporting browser. Google documents this approach and the certificate association it requires in its [TWA quick start](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start).

Updated October 17, 2026 for PWA version 7.0.1. Current source includes email/password signup/login, emailed confirmation for every fresh session, Django/PostgreSQL progress sync and a staff-only owner dashboard. Mailgun handles transactional account email. Its supplied sandbox is restricted to authorized test recipients; a verified custom sending domain is required for public signup. Render deployment and private server configuration remain outstanding; no production account service or email delivery has been established. The questionnaire remains one question per screen, followed by a schedule review and Home. There are 40 routines, eight body areas, ten goals, eight flexible program templates and 37 illustrated movements, plus a separate adult pelvic-floor trainer. Adult abs and Curves templates start at twelve/eight weeks and both can use 2–52 weeks; gender does not restrict these goals or calculate a dose. Custom routines, reports, reminders, body journals and estimates remain. See [account setup](../docs/authentication-setup.md). Android remains source preparation only.

**Release state: source preparation only.** No Android SDK/JDK was available during this preparation. No keystore, real certificate association, APK, signed Android App Bundle (AAB), Play Console app, or Play submission has been created. A config template and passing web checks do not establish Play approval.

## Identity and hosting

| Item | Prepared value |
| --- | --- |
| Product | FORM — Calisthenics |
| Suggested application ID | `io.github.trustidiong.calisthenics` — owner must finalize before the first Play upload |
| Existing static PWA | `https://trust-idiong.github.io/calisthenics/dist/` |
| Existing static manifest | `https://trust-idiong.github.io/calisthenics/dist/manifest.webmanifest` |
| Existing static privacy page | `https://trust-idiong.github.io/calisthenics/dist/privacy.html` |
| Static-origin certificate association | `https://trust-idiong.github.io/.well-known/assetlinks.json` |
| Final account origin | The deployed Render/custom origin; not provisioned yet |

Digital Asset Links verifies the **HTTPS origin** and is read from that origin's root. For the existing static app, putting `assetlinks.json` at `/calisthenics/.well-known/` or `/calisthenics/dist/.well-known/` will not verify the TWA; the user-site repository would need to serve the root association. For the final Render/custom account origin, serve `/.well-known/assetlinks.json` on that hostname and update the launcher/template accordingly. No association or separate repository has been published here. See Google's [Android concepts for web developers](https://developer.chrome.com/docs/android/trusted-web-activity/android-for-web-devs).

Only certificate fingerprints are public; keystores and passwords remain private. The final package ID must stay consistent across the Android project, the Play Console app, and root asset links.

## Reproducible build preparation on Windows

Run commands from `C:\Users\User\OneDrive\Desktop\JAHMAK\CALLISTENICS`. Bubblewrap CLI version `1.27.0` was the published npm version checked on October 12, 2026. The [official CLI reference](https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli) describes initialization, signing prompts, and build output. Pinning the version makes the tool invocation reproducible; record the selected SDK/JDK and generated Gradle wrapper as well.

1. Finalize the owner identity, application ID, target audience and production HTTPS origin. The account deployment serves Django and the PWA on the same Render/custom origin. The current TWA template points at the static GitHub Pages address and must be updated to the final account-enabled origin before building. A new origin does not receive old browser-local records automatically; export/restore a backup or use the explicit device-record import after signing in.
2. Obtain the owner's **real** upload/signing keystore and alias outside this repository and outside the public hosting directory. If a new key is needed, the owner should create and back it up privately. Do not place its passwords in command arguments, source, or issue reports. Configure Bubblewrap's compatible JDK/Android SDK, using its interactive setup or `updateConfig`, then run `doctor`.

```powershell
npx --yes --package=@bubblewrap/cli@1.27.0 bubblewrap doctor
```

3. Create the ignored Android output directory and initialize from the final published manifest. At prompts, use the finalized package ID, FORM name, final account-enabled launch path and the owner's actual keystore/alias. The example below uses the existing static PWA; replace its manifest URL for the final Render/custom origin. Keep native notification delegation, location, billing and analytics integrations disabled for this release. Optional foreground browser alerts and calendar exports do not establish native background scheduling or server push.

```powershell
New-Item -ItemType Directory -Force -Path '.\android-release\generated\android'
Push-Location '.\android-release\generated\android'
npx --yes --package=@bubblewrap/cli@1.27.0 bubblewrap init --manifest=https://trust-idiong.github.io/calisthenics/dist/manifest.webmanifest
Pop-Location
```

4. Compare the generated `twa-manifest.json` with the tracked template. The template's `REPLACE_...` fields must **never** be used to build. To create a reviewable resolved manifest from an existing keystore, use the helper below, replacing all three owner-specific inputs. This writes a new file and refuses to overwrite an existing file. Review it before copying its relevant values into the initialized manifest; preserve any generated fields needed by the pinned CLI.

```powershell
node scripts/android-configure.mjs --package YOUR_FINAL_ID --signing-key 'C:\PRIVATE\actual-upload-key.jks' --key-alias YOUR_ACTUAL_ALIAS
```

5. Regenerate after editing the initialized manifest, then inspect SDK settings. The phone app must currently target API **36 or higher**; [Android's target API requirements](https://developer.android.com/google/play/requirements/target-sdk) took effect August 31, 2026. Do not invent a `targetSdkVersion` field in the TWA JSON: verify the generated `app/build.gradle`. Regeneration can overwrite manual Android edits. Recheck after every `bubblewrap update`; upgrade the pinned generator/toolchain if it emits an obsolete target.

```powershell
Push-Location '.\android-release\generated\android'
npx --yes --package=@bubblewrap/cli@1.27.0 bubblewrap update --skipVersionUpgrade
Pop-Location
node scripts/android-check-project.mjs --project '.\android-release\generated\android' --package YOUR_FINAL_ID
```

6. Build using the interactive signing prompts. A Google Play upload needs the signed **AAB**, with an increasing version code on each update. Do not use `--skipSigning` or skip PWA validation to label a release successful. Inspect Bubblewrap's returned output paths rather than assuming an unsigned file is ready.

```powershell
Push-Location '.\android-release\generated\android'
npx --yes --package=@bubblewrap/cli@1.27.0 bubblewrap build
Pop-Location
```

For a valid initialized project, normal output includes `app-release-bundle.aab` and a signed APK for device testing. Verify the actual output signature with the JDK/Android tooling and record the exact version code; the source checks cannot verify it.

## Signing and Digital Asset Links

With [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756), the upload key authenticates uploads and Google signs installed production APKs with the app signing key. These certificates can differ. After enrolling the app, retrieve the **app signing key certificate SHA-256 fingerprint** from Play Console's app signing/app integrity page. Root `assetlinks.json` must contain that certificate for the Play-installed app. Include an additional actual local signing certificate only if local APK testing must verify too.

For a local keystore, inspect the real certificate interactively:

```powershell
keytool -list -v -keystore 'C:\PRIVATE\actual-upload-key.jks' -alias YOUR_ACTUAL_ALIAS
```

Generate the association using the actual final application ID and fingerprint; the placeholders below deliberately fail validation:

```powershell
node scripts/android-assetlinks.mjs --package YOUR_FINAL_ID --fingerprint ACTUAL_PLAY_APP_SIGNING_SHA256
```

The generator accepts repeated `--fingerprint` arguments for genuine additional certificates. It writes an ignored `android-release/generated/assetlinks.json`, refuses to overwrite files, and does not publish it. Merge the generated relation into the origin owner's existing root association rather than deleting associations for other apps. Serve it as JSON over HTTPS, HTTP 200, without login or redirect. Recheck after signing-key upgrades.

```powershell
node scripts/android-verify-host.mjs --package YOUR_FINAL_ID --fingerprint ACTUAL_PLAY_APP_SIGNING_SHA256
```

The helper defaults to the existing static host. For an account-enabled root deployment, add `--origin https://YOUR_ACTUAL_HOST --path /` using the real final hostname.

This checks public resources and the root association. It does not prove an installed APK's signature. Test an install from the intended Play testing track on a real phone; a visible Chrome toolbar usually indicates failed verification. Verify signup consent, delivered email confirmation, confirmation on each fresh login, reset/deletion, separate user namespaces, second-device sync, conflicts, denied owner access for normal users, questionnaire Back/Next/resume, final plan review, Home routes, offline retry, timer recovery and backup export/restore. Check movement guidance, custom routines, programs, reports, videos, speech and calendar alarms on the target devices. Local tests do not establish actual Mailgun delivery or hosted connectivity. TWA data belongs to the browser's origin storage; removing only the launcher may leave it intact. Imported calendars require separate deletion.

## Owner actions before a Play submission

- Create/verify the developer account, accept Play agreements, finalize the package ID and signing custody, and configure Play App Signing. No account or keys were supplied for this work.
- Provide a public support email or other supported contact details for the listing. The app privacy page currently identifies Trust Idiong and links to public repository issues; no private Git email was copied into the app. Provide a suitable private privacy-contact mechanism before store release, and do not ask users to post health records in public issues.
- Review actual privacy disclosure, exercise guidance, age groups and store claims. Ages 16–17 and adult groups are supported; weight-loss targets, appearance-oriented abs/Curves plans, pelvic-floor practice and body-measurement controls are adult-only. Energy estimates are restricted to ages 19–59. Measurements are entered observations and strength assessments do not establish body definition or shape. Pelvic-floor practice requires suitability/readiness checks, emphasizes full release and records practice rather than sexual performance. Do not claim guaranteed stamina, six-pack definition, an hourglass shape or ideal body ratios. Estimates use generic effort and elapsed time including rest; they are not sensor measurements or weight-change predictions. Assess requirements for minors before choosing Play audience groups. This is general fitness guidance, with no clinical review or medical-device claim.
- Complete health, Data safety, content rating, target audience, ads and app access forms from the final artifact and its real network behavior. Account identity and full profile/progress snapshots upload to the Django/PostgreSQL service; Mailgun processes transactional email. Earlier device-only declarations are insufficient. Provide a working account-deletion process and reviewer access instructions that accommodate email confirmation. See [account setup](../docs/authentication-setup.md) and [store-content-draft.md](store-content-draft.md); these are source inventories/drafts, not completed declarations.
- Supply genuine phone screenshots, the store icon and feature graphic, and test on representative phones, Android versions, screen sizes, text scaling and accessibility settings. Capture the catalog, movement guides, custom routine builder, chosen program schedule, guided timer, reports and Profile controls. Keep estimates labeled and reminder limitations visible. The browser preview is not Android device QA.
- If this is a personal developer account created after November 13, 2023, Google's [closed testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465) currently require at least 12 testers continuously opted in for 14 days before applying for production access. Check the actual account's requirements.

Run tooling checks with `node --test android-release/tooling.test.mjs`. Passing them validates certificate/configuration handling; it does not build an Android app or certify legal compliance.
