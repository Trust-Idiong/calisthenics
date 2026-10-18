# Accounts, email confirmation and progress sync

Updated October 17, 2026 for version 7.0.1. The requested account mode uses **Django, PostgreSQL and Mailgun**, with a private owner dashboard. The earlier device-only/Firebase preparation has been replaced.

## Deployment status

Account forms, the client sync layer and the Django backend are in the repository. **The Render service and PostgreSQL database have not been provisioned, and production email delivery is not connected.** No real user or owner account was created, and no confirmation email was sent during development. GitHub Pages serves static files and cannot run Django. Its account forms explain when the backend is unavailable.

Render account access and a deployed Blueprint are still needed. Configure Mailgun's private API credential, sending domain and From address in the server environment. The supplied setup uses the US API endpoint, `https://api.mailgun.net`, and a sandbox domain. Public launch requires an owner-controlled custom sending domain verified in Mailgun; the sandbox does not support unrestricted signup. See [backend setup](backend-setup.md) for exact environment variables, deployment commands and API endpoints. Keep private keys, database credentials and passwords out of frontend files, Git and public issue reports.

For controlled sandbox testing, set `MAILGUN_SANDBOX_RECIPIENTS` privately in Render to a comma-separated list of at most five distinct bare email addresses. Each listed person must independently accept Mailgun's authorization invitation; the server list does not authorize them with Mailgun. Mailgun allows at most five authorized sandbox recipients. See the [official recipient instructions](https://help.mailgun.com/hc/en-us/articles/217531258-Authorized-Recipients). The backend checks this allowlist before signup/challenge creation and again before transport; empty or invalid sandbox configuration fails closed. Public signup requires the verified custom domain and delivery checks. No actual test email has been sent from this implementation yet.

## User flow

1. **Sign up:** enter a name, email and password, and explicitly agree to server storage of the profile/progress and owner monitoring of training records.
2. **Confirm email:** open the emailed link to establish the authenticated session. A password alone does not grant access to an unconfirmed session.
3. **Set up a plan:** gender and the remaining questionnaire appear one screen at a time, followed by an actual schedule review and Home.
4. **Log in later:** enter the email/password and confirm a new emailed link for each fresh login session. An already established session can be restored until it expires or is ended.
5. **Forgot password:** request a reset link; the response avoids revealing whether an address is registered. Resetting a password does not bypass email confirmation for the next login.

Confirmation tokens are stored hashed, expire after 15 minutes, and can be used only once. Resending requires a 60-second wait and replaces the earlier token. Links are consumed by the confirmation action rather than a page-preview GET. Mailgun sends account confirmation and password-reset messages through its [transactional HTTPS API](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages); the API key stays on the server. A queued-message response is not proof that an email reached an inbox.

Password-reset responses depend on configuration eligibility, not account existence. Missing global email configuration returns **503** for known and unknown addresses. With a sandbox domain, an address outside the local allowlist also receives **503**, before account lookup. Eligible addresses receive the same **202** acknowledgment whether registered or unknown, including a registered account's transport failure; an acknowledgment does not confirm delivery. These response guarantees do not promise equal request timing.

## Progress and device copies

The authenticated user's complete version-4 profile/progress snapshot is stored in PostgreSQL. This includes plan preferences, workouts/walking, assessments, optional body records, favorites, custom routines, program status, reminder/estimate settings and adult pelvic-floor practice preferences. Current pelvic symptom/readiness answers are not saved. A separate browser namespace holds each UID's device copy. Existing device-only records remain available for an explicit import; signing in does not silently merge another profile's history.

Changes save locally first and upload when the verified account server is reachable. Offline changes remain pending for retry; offline status does not authorize owner access or provide a new login. After reconnecting, an expired session requires confirmation again before upload. A workout checkpoint and unfinished questionnaire remain device-local.

Every save carries a revision. A conflict preserves the local copy and offers an explicit choice instead of overwriting the server's newer state. Progress deletion retains a revision tombstone so a stale tab cannot recreate the cleared server record. `X-FORM-User` binds progress/owner requests to the expected UID, while Django's authenticated session authorizes them. Unsafe requests require CSRF protection. Production session cookies are HttpOnly and Secure; passwords and session tokens are not stored in localStorage.

## Private owner dashboard

The dashboard is available only to a server-granted staff/superuser account with an email-confirmed session. Create the owner interactively through Django administration; there are no default owner credentials and no browser control for granting staff privileges.

The owner can search registered users and view account identity, logged workout counts/minutes, training dates, plan goals and permitted performance records. Dashboard responses exclude body measurements, weigh-ins, weight targets/baselines, birth year, gender, movement restrictions, free-text notes and effort/soreness. Pelvic-floor entries contribute actual counts/minutes with the generic title “Private wellness session”; their technique settings and specific routine metadata remain private in this response. Training logs are entered records, not independently verified physical activity. The account's full private snapshot still resides in the database for sync; database administrators and hosting infrastructure have operational access.

## Deletion and verification

Users can export a plain JSON backup, clear saved progress, or delete their account after entering their password. Account deletion removes the live account and its server progress. Local copies on other devices, exported files, imported calendars and historical hosting backups need their own retention/deletion process. Provide a real privacy/support contact and backup-retention policy before store submission.

Automated tests check confirmation expiry/reuse, resend limits, permissions, CSRF, account isolation, state validation and conflict handling. They do not establish deployed Render availability, Mailgun inbox delivery, phone installation or Android signing. Validate signup, confirmation, fresh login, reset, second-device sync, owner access denial, deletion and offline retry against the actual deployment before describing accounts as live.
