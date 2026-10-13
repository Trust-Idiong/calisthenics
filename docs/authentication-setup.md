# Current device profiles and future account preparation

Prepared October 13, 2026 for version 6.

## Current release state

The user chose **device-only profiles for this release**. Welcome's **LET'S GO** begins the questionnaire at gender; **Your device profile** opens a local profile page with a continue/create-plan action and privacy information. No cloud account or password is required. This is the complete chosen mode, not a pending authentication-service connection.

The Firebase adapter and connection helper are retained as **inactive preparation for possible future accounts**. `AUTH_CONFIG.firebase` is `null`; no Firebase project is connected and no remote signup/login/reset is presented as working. A local device profile does not create a cloud account or save a password. The steps below are future implementation reference, not current setup requirements or a release blocker.

No Firebase or Supabase project, admin credential, service account or real user account was created during implementation. No Firebase/gcloud CLI or existing provider configuration was found for this project. Adapter tests use a test-only SDK substitute and do not verify a live backend.

## Future Firebase connection reference

1. Create or select the intended Firebase project and register a Web App in [Firebase Console](https://console.firebase.google.com/). Copy its **public Web configuration object**; Google documents those identifiers in [Understand Firebase for web](https://firebase.google.com/docs/web/learn-more#config-object). Do not supply service-account JSON or private keys.
2. Enable **Email/Password** in Authentication's sign-in methods. Enable **Google** if Google sign-in is desired and complete the provider's required project/support settings. Follow the official [password authentication](https://firebase.google.com/docs/auth/web/password-auth) and [Google authentication](https://firebase.google.com/docs/auth/web/google-signin) instructions.
3. Add `trust-idiong.github.io` to Authentication's authorized domains for the public PWA. Authorize the exact hostname of any other release origin separately. Add `localhost` only if it is needed for development; this is not a repository subpath or full URL.
4. Save the copied public Web configuration as a JSON object with `apiKey`, `authDomain`, `projectId` and `appId`. Run from the project directory:

```powershell
node scripts/auth-configure.mjs --input 'C:\PATH\public-firebase-web-config.json'
```

The helper writes the public [auth-config.js](../dist/auth-config.js) and rejects private/service-account fields. It does not create a project, enable providers, authorize domains, deploy, or prove that the provider is reachable. It retains only the fields used by the auth adapter; no Analytics or Firestore SDK is loaded.

5. A future account release would also connect the appropriate UI, update privacy/store declarations for the provider data and test real creation, login, Google sign-in, reset-email receipt, verification and deletion, including recent-login requirements. None of this is needed for the confirmed current device-only release.

## Future adapter behavior

The adapter lazily imports only Firebase App and Auth from Google's official modular CDN, pinned to **13.0.0** as listed in the [current CDN setup guide](https://firebase.google.com/docs/web/alt-setup). Unconfigured and offline startup does not import the remote SDK. It does not manufacture a successful session or store passwords/custom refresh tokens in application code. Firebase manages the configured session persistence; see [Authentication state persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence).

Email signup requires at least eight password characters locally, and the provider's password policy is still authoritative. Password reset and verification call the provider; the UI must not interpret a request acknowledgment as proof that an email arrived.

Google uses the official popup method. Firebase documents popup sign-in as an option for separately hosted sites when cross-origin storage restrictions prevent redirect auth; see [redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices). The adapter reports blocked or cancelled popups and does not silently fall back to an unconfigured redirect. Mobile and installed-PWA Google sign-in still need real-device testing.

The API includes `ready`, `getSession`, signup/login/reset, Google sign-in, verification, sign-out and provider-backed account deletion. A session snapshot exposes identity fields, not OAuth or refresh tokens. Firebase [requires recent authentication for account deletion](https://firebase.google.com/docs/auth/web/manage-users#delete_a_user); a rejected deletion must preserve the current account and explain that sign-in is needed again.

## Prepared identity support does not synchronize training

The current device profile retains the original `form-seven.v1` record namespace. Prepared future account support selects a separate namespace by Firebase UID, with its own workout records, interruption checkpoint and setup draft. Account switching must pause activity and select that namespace without overwriting another profile's records; this is not an active cloud-account feature in the current release.

Firebase Authentication does not provide workout-cloud storage. Guest history is not silently uploaded or moved into a newly signed-in account. Use an explicit backup export/restore in the intended profile to transfer training records. A new browser, device or website origin starts with its own local store.

Device profiles can use the cached workout app offline. Remote signup, login, reset, verification and account deletion require a connection. On offline startup the adapter returns no authenticated session; this alone does not establish access to an account-specific local namespace. Do not describe a remembered device profile as a freshly authenticated cloud account.

## Deletion and storage limits

In the current device-only app, deleting local records clears the device profile's training records, setup draft and checkpoint in this browser. Other browser/device copies, exported files and imported calendar events need separate deletion. A future connected Firebase account would have a separate provider deletion operation and must also clear that profile's local records without affecting other namespaces.

UID namespacing prevents ordinary UI account mixing; it is not encryption or an access-control boundary against someone with browser/device access. Firebase's persisted session and the app's unencrypted local health/fitness records have distinct storage/security behavior. Account creation also changes applicable Play account-deletion and Data safety declarations; review the final connected behavior before store submission.
