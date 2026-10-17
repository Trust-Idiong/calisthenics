# Accounts, email confirmation and progress sync

Updated October 16, 2026 for version 7.0.0. The requested account mode uses **Django, PostgreSQL and Brevo**, with a private owner dashboard. The earlier device-only/Firebase preparation has been replaced.

## Deployment status

Account forms, the client sync layer and the Django backend are in the repository. **The Render service and PostgreSQL database have not been provisioned, and production email delivery is not connected.** No real user or owner account was created, and no confirmation email was sent during development. GitHub Pages serves static files and cannot run Django. Its account forms explain when the backend is unavailable.

Render account access, a deployed Blueprint, a private Brevo API key and a Brevo-verified sender are still needed. The supplied Brevo campaign-page link identifies the provider; it does not provide transactional-email credentials. See [backend setup](backend-setup.md) for exact environment variables, deployment commands and API endpoints. Keep private keys, database credentials and passwords out of frontend files, Git and public issue reports.

## User flow

1. **Sign up:** enter a name, email and password, and explicitly agree to server storage of the profile/progress and owner monitoring of training records.
2. **Confirm email:** open the emailed link to establish the authenticated session. A password alone does not grant access to an unconfirmed session.
3. **Set up a plan:** gender and the remaining questionnaire appear one screen at a time, followed by an actual schedule review and Home.
4. **Log in later:** enter the email/password and confirm a new emailed link for each fresh login session. An already established session can be restored until it expires or is ended.
5. **Forgot password:** request a reset link; the response avoids revealing whether an address is registered. Resetting a password does not bypass email confirmation for the next login.

Confirmation tokens are stored hashed, expire after 15 minutes, and can be used only once. Resending requires a 60-second wait and replaces the earlier token. Links are consumed by the confirmation action rather than a page-preview GET. Brevo sends account confirmation and reset messages through its [transactional HTTPS API](https://developers.brevo.com/reference/send-transac-email); the API key stays on the server. Configure and verify the sender/domain as described in [Brevo's sending guide](https://developers.brevo.com/docs/send-a-transactional-email). Sending acceptance is not proof that an email reached an inbox.

## Progress and device copies

The authenticated user's complete version-4 profile/progress snapshot is stored in PostgreSQL. This includes plan preferences, workouts/walking, assessments, optional body records, favorites, custom routines, program status, reminder/estimate settings and adult pelvic-floor practice preferences. Current pelvic symptom/readiness answers are not saved. A separate browser namespace holds each UID's device copy. Existing device-only records remain available for an explicit import; signing in does not silently merge another profile's history.

Changes save locally first and upload when the verified account server is reachable. Offline changes remain pending for retry; offline status does not authorize owner access or provide a new login. After reconnecting, an expired session requires confirmation again before upload. A workout checkpoint and unfinished questionnaire remain device-local.

Every save carries a revision. A conflict preserves the local copy and offers an explicit choice instead of overwriting the server's newer state. Progress deletion retains a revision tombstone so a stale tab cannot recreate the cleared server record. `X-FORM-User` binds progress/owner requests to the expected UID, while Django's authenticated session authorizes them. Unsafe requests require CSRF protection. Production session cookies are HttpOnly and Secure; passwords and session tokens are not stored in localStorage.

## Private owner dashboard

The dashboard is available only to a server-granted staff/superuser account with an email-confirmed session. Create the owner interactively through Django administration; there are no default owner credentials and no browser control for granting staff privileges.

The owner can search registered users and view account identity, logged workout counts/minutes, training dates, plan goals and permitted performance records. Dashboard responses exclude body measurements, weigh-ins, weight targets/baselines, birth year, gender, movement restrictions, free-text notes and effort/soreness. Pelvic-floor entries contribute actual counts/minutes with the generic title “Private wellness session”; their technique settings and specific routine metadata remain private in this response. Training logs are entered records, not independently verified physical activity. The account's full private snapshot still resides in the database for sync; database administrators and hosting infrastructure have operational access.

## Deletion and verification

Users can export a plain JSON backup, clear saved progress, or delete their account after entering their password. Account deletion removes the live account and its server progress. Local copies on other devices, exported files, imported calendars and historical hosting backups need their own retention/deletion process. Provide a real privacy/support contact and backup-retention policy before store submission.

Automated tests check confirmation expiry/reuse, resend limits, permissions, CSRF, account isolation, state validation and conflict handling. They do not establish deployed Render availability, Brevo inbox delivery, phone installation or Android signing. Validate signup, confirmation, fresh login, reset, second-device sync, owner access denial, deletion and offline retry against the actual deployment before describing accounts as live.
