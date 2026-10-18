# Django accounts, saved progress, and owner monitoring

The backend in `backend/` serves the complete PWA from `dist/` and its JSON API from `/api/` on one HTTPS origin. Production requires PostgreSQL. GitHub Pages and the existing static preview do not run Python or provide accounts. This repository includes deployable source; a Render account, deployed service/database, owner account, and privately configured Mailgun transactional email are still required before the public account experience is operational. Mailgun sandbox domains support limited authorized-recipient testing; public signup requires a verified custom sending domain.

The browser receives a Django session cookie, not a password or authentication token to store in localStorage. Accounts use unique normalized email addresses, hashed passwords, and UUID identifiers. Signup requires explicit consent to server storage and owner monitoring of training progress. Password verification starts an email challenge; signup and every fresh sign-in require explicitly confirming its emailed link before a session is created. Server permissions control owner access; a profile field, email address, or browser flag cannot grant it.

## Local development

Run from the repository root using Python 3.14.6:

```powershell
python -m venv output/backend-venv
& ./output/backend-venv/Scripts/python.exe -m pip install -r backend/requirements.txt
$env:DJANGO_DEBUG = 'true'
$env:ALLOW_SQLITE = 'true'
& ./output/backend-venv/Scripts/python.exe backend/manage.py migrate
& ./output/backend-venv/Scripts/python.exe backend/manage.py runserver 127.0.0.1:8000
```

Open `http://127.0.0.1:8000/`. SQLite is an explicit local development fallback, never the production database. Use a dedicated PostgreSQL `DATABASE_URL` and `DATABASE_SSL_REQUIRE=false` for a loopback server without TLS. Do not turn off database TLS for Render. The checked-in `.env.example` describes variables; Django does not automatically read that file.

## Verification

```powershell
& ./output/backend-venv/Scripts/python.exe backend/manage.py test core --settings=config.test_settings
& ./output/backend-venv/Scripts/python.exe backend/manage.py makemigrations --check --dry-run --settings=config.test_settings
```

For real PostgreSQL tests, use a disposable database and a role allowed to create its temporary test database:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:54327/form_test'
$env:TEST_DATABASE_SSL_REQUIRE = 'false'
& ./output/backend-venv/Scripts/python.exe backend/manage.py test core --settings=config.postgres_test_settings
```

The PostgreSQL suite exercises concurrent first saves, delete/save conflicts, and single-use email confirmations on separate database connections. SQLite skips these concurrency tests because its locking behavior differs. Never use production database credentials for this command. Tests also cover CSRF, account switching, consent, password reset, deletion, schema preservation, revision conflicts, required confirmation, expiration, resends, credential changes, transport failures, sandbox restrictions, and restricted owner responses. All Mailgun HTTP calls are mocked with fictional keys; no test contacts the provider or sends real mail.

## Render deployment

Connect the `Trust-Idiong/calisthenics` repository to Render and select the root `render.yaml` Blueprint. It provisions a paid web service and paid PostgreSQL instance in Oregon with external database access disabled. Review recurring charges in [Render pricing](https://render.com/pricing) before applying. No hosted resources or billing have been created by these files.

The build installs dependencies, gathers Django admin assets, and runs production security checks. The pre-deploy command applies migrations. Gunicorn serves Django; WhiteNoise serves `dist/` at the origin root. Health checks use `/api/health/` and query the database. These follow the [official Django deployment guide](https://render.com/docs/deploy-django). The [Blueprint reference](https://render.com/docs/blueprint-spec) documents the configured plans, environment references, and commands; [Python version settings](https://render.com/docs/python-version) explain the explicit runtime pin.

`DJANGO_SECRET_KEY` is generated privately; `DATABASE_URL` references the managed PostgreSQL connection string. Render's hostname is automatically added to allowed hosts and the reset-link origin. Keep `DJANGO_DEBUG=false` and `API_ORIGINS` empty. For a custom domain set `DJANGO_ALLOWED_HOSTS` and `PUBLIC_APP_URL` to its hostname and HTTPS URL, respectively; include that HTTPS origin in `CSRF_TRUSTED_ORIGINS` through the `API_ORIGINS` setting only if a separate trusted frontend needs it. Same-origin hosting is preferred: browser restrictions on third-party cookies can break cross-site sessions despite CORS settings.

Configure `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_API_BASE_URL`, `MAILGUN_SENDER_EMAIL` and `MAILGUN_SENDER_NAME` in Render's Environment page. The API key is read only from the private server environment. A key shared in chat must be revoked and replaced before production; never copy it into client code, Git, screenshots, commands or logs. The Blueprint includes the supplied nonsecret US sandbox domain and its postmaster sender as testing defaults; it prompts privately for a new key and `MAILGUN_SANDBOX_RECIPIENTS`. It has not created a Mailgun or Render resource.

The only accepted API bases are `https://api.mailgun.net` (US) and `https://api.eu.mailgun.net` (EU). Choose the region matching your Mailgun domain. Domain labels are validated before they enter the fixed-origin `/v3/{domain}/messages` path; arbitrary hosts, paths, credentials, queries and redirects are rejected. The standard-library transport uses HTTPS, HTTP Basic authentication with username `api`, real multipart/form-data, and a ten-second timeout. Open/click tracking is explicitly disabled to protect confirmation URLs. Onward mail delivery requires TLS with certificate verification; recipients whose mail servers cannot meet that requirement will not receive the message. No campaigns, mailing lists or contact subscriptions are created. The official [send API reference](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages) documents the fields and response, and the [HTTP sending guide](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-http) explains acceptance and delivery events.

For any `*.mailgun.org` sandbox domain, set `MAILGUN_SANDBOX_RECIPIENTS` to one through five comma-separated bare email addresses privately. Each person must also accept Mailgun's authorized-recipient invitation. The local list is an additional safeguard and does not authorize recipients with Mailgun. Empty, invalid or oversized lists fail closed. Unlisted recipients cannot create accounts, request sign-in emails, resend confirmations or receive password resets. No unlisted signup account/challenge is persisted. Mailgun independently enforces its own authorization and delivery rules, so a local allowlist is not proof of delivery. See [Mailgun sandbox restrictions](https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-sandbox). For public launch, verify a custom sending domain in Mailgun, complete the required DNS setup, update the domain/sender/region, and then perform a deliberate delivery test. Do not present the supplied sandbox as public email capability.

Use `PUBLIC_APP_URL` when overriding the default Render origin. It must point to the deployed app so confirmation/reset links return there. Keep secrets and authorized-recipient addresses private. The example environment file contains placeholders only; the application deliberately does not load `.env` files automatically.

Missing mail configuration blocks signup, sign-in and resends with 503. If Mailgun rejects or cannot accept a confirmation message, the request fails with 503, the transaction rolls back, and no account session starts. Mailgun's 200 response with an ID and queue message acknowledges acceptance, not delivered email. Test inbox delivery on the hosted app. Provider failures are logged generically without recipient, key or token. Password-reset requests return the same 202 status/body for eligible known and unknown addresses, including known-user transport failures. Missing global configuration returns 503 for everyone; sandbox recipients outside the local allowlist receive the same 503 whether or not an account exists. Transport remains synchronous, so reset response timing is not guaranteed uniform. Reset links expire after one hour and become unusable after a password change.

Confirmation links contain a 256-bit random token in the URL fragment, expire after 15 minutes, and work once. Only a keyed token digest is stored. Opening a link alone performs no login: the app removes its token from the address bar and asks the person to choose **Confirm sign-in** before posting it. Resends wait at least 60 seconds, allow at most five sends per challenge, and replace the old token. Eight incorrect token attempts close the challenge. A fresh sign-in invalidates earlier outstanding links. Inactive accounts, email changes and password changes invalidate existing links; Django session-password hashes and the confirmed email binding invalidate old sessions when credentials change. A confirmed session can persist for up to 14 days, so email is required for each fresh sign-in rather than each screen or workout.

Create the owner account in the Render service shell:

```bash
python backend/manage.py createsuperuser
```

Choose your own email/password interactively; no default owner credentials exist. Sign into the PWA and confirm its email with that account for the owner dashboard, then use `/admin/` for account administration if needed. Django admin redirects unauthenticated owners to the same app sign-in flow and requires the confirmed session; its independent password-only login cannot bypass email confirmation. Django's admin does not expose raw progress snapshots. Grant/revoke staff status only through trusted administration. Schedule or manually run `python backend/manage.py cleanup_auth_metadata` periodically to remove expired sessions, challenges and old rate-limit records. Rate limits use PostgreSQL, so multiple workers share them. Leave `TRUST_PROXY_IP=false` unless your deployment's trusted proxy header behavior has been verified; forwarded IP headers are never authentication.

After deployment verify signup and confirmation delivery, fresh logout/login confirmation, resend/expired/reused links, reload on a second device, a revision conflict, owner denial for a normal account, password reset delivery, account deletion, and install/offline behavior on a physical phone. Keep database backups and test recovery using Render's PostgreSQL tools. Hosting availability, capacity, delivered email, and physical-device behavior are not established by local unit tests.

## API contract

All paths end in `/`. Fetch `/api/auth/session/` to receive `{user,csrfToken}`. Send `X-CSRFToken` with every unsafe method and include session cookies using `credentials:'same-origin'`. Successful email confirmation creates the session and rotates the CSRF token; use the returned replacement. Django enforces [CSRF protection](https://docs.djangoproject.com/en/6.1/ref/csrf/) for these JSON APIs.

Every progress and owner request must also send `X-FORM-User` equal to the UID captured by the frontend session. A missing or mismatched header returns `401 auth/session-changed` before reading or writing. This prevents an old tab's queued save from reaching a different account after another tab changes the shared session cookie. The header binds the request to an expected account; only the authenticated cookie authorizes it.

| Endpoint | Method and result |
| --- | --- |
| `/api/auth/session/` | GET `{user:null or {uid,email,displayName,emailVerified:true,isAdmin},csrfToken}`; unconfirmed sessions are discarded |
| `/api/auth/signup/` | POST `{email,password,displayName,trackingConsent:true}`; 202 `{confirmationRequired:true,challengeId,maskedEmail,expiresAt,resendAfter}` with no session |
| `/api/auth/login/` | POST `{email,password}`; same 202 challenge response with no session |
| `/api/auth/confirm-email/` | POST `{challengeId,token}`; consumes challenge and returns `{user,csrfToken}` |
| `/api/auth/resend-confirmation/` | POST `{challengeId}`; 202 refreshed challenge response after the waiting period |
| `/api/auth/logout/` | POST; ends current session |
| `/api/auth/password-reset/` | POST `{email}`; eligible known/unknown addresses get 202, including transport failure; missing configuration or a sandbox-unlisted address gets 503 for both |
| `/api/auth/password-reset-confirm/` | POST `{uid,token,password}`; resets password using emailed link |
| `/api/auth/delete-account/` | POST `{password}`; verifies password and atomically deletes user/progress |
| `/api/progress/` | GET `null` for an initial empty head, otherwise `{state,revision,updatedAt}` |
| `/api/progress/` | PUT `{state,baseRevision}`; initial revision is 0; successful write increments it |
| `/api/progress/` | DELETE `{baseRevision?}`; clears state and increments the retained revision |
| `/api/owner/users/` | GET `pageSize` 1–100, signed `cursor`, optional name/email `search`; returns `{users,nextCursor,total}` |
| `/api/owner/users/<uid>/progress/` | GET restricted training details; staff/superuser only |
| `/api/health/` | GET database health; no account data |

Errors are JSON `{code,message,fields?}`. Stale writes return HTTP 409 with `fields.currentRevision` and `fields.expectedRevision`; they never overwrite the saved head. A deletion retains a revision tombstone, preventing stale uploads from recreating cleared state. The client should keep its local copy for explicit conflict review. PostgreSQL locks the account row even before its first progress record exists.

The backend accepts the complete current version-4 state, validates bounded collections and safe identifiers, and preserves all supported fields. The JSON request limit is 8 MiB; unsupported fields or oversized histories fail explicitly and leave both the server head and the local backup intact. Older backups must first pass the app's existing migration/validation. Plan editing, body measurements, custom routines, reminder preferences, and estimate input snapshots are retained in the user's own state.

## Owner access and privacy

The directory exposes account email/name, creation/last-active dates, actual logged workout count and minutes, UTC calendar streak, goal type, and plan dates. Detail responses contain only goal/schedule preferences, dated workout/walk records, and non-weight performance assessments. They exclude body measurements, weigh-ins, weight targets/baselines, birth year, gender, movement restrictions, estimate age/mass, free-text notes, and effort/soreness. Pelvic practice preferences are private; completed pelvic practices contribute actual minutes/count but appear as **Private wellness session** with specific routine metadata removed. Workout minutes and assessments are user-generated records, not verified activity measurements or medical findings. Kcal values remain labeled estimates where applicable.

The full private snapshot is stored server-side for that account's synchronization; the owner dashboard receives the narrower response. Database administrators and hosting infrastructure have operational access to the database, so the restricted dashboard must not be described as end-to-end encryption. Session cookies are HttpOnly/Secure in production, with SameSite=Lax for same-origin deployment. API responses prohibit caching. Password hashing and validation use [Django authentication](https://docs.djangoproject.com/en/6.1/topics/auth/passwords/).

Deleting server progress or an account does not remove copies on other devices, user-exported backup files, imported calendar reminders, or historical hosting backups automatically. Configure appropriate backup retention and provide a real support/deletion contact before store submission. The static privacy page and Google Play Data Safety declarations must reflect this deployed account mode; earlier device-only declarations are insufficient once server storage is enabled.
