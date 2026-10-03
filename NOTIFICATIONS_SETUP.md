# Attendance notification deployment

The application code is complete, but push delivery needs deployment credentials owned by the school.

## 1. Database

Run `backend/sql/008_push_notifications.sql` once in the Supabase SQL Editor.

## 2. Web Push keys

Generate one VAPID key pair and keep the private key secret:

```bash
npx web-push generate-vapid-keys --json
```

Configure the backend host with:

- `VAPID_PRIVATE_KEY`: generated private key
- `VAPID_CLAIM_EMAIL`: a school contact in `mailto:name@example.com` format
- `NOTIFICATION_CRON_SECRET`: a long random value, for example from `openssl rand -hex 32`

The backend derives and publishes the matching public key to the PWA. No Vercel
VAPID variable is required. `VITE_VAPID_PUBLIC_KEY` remains an optional fallback.

## 3. Scheduler inside the Render backend

The FastAPI lifespan starts a background scheduler automatically. No separate
cron service or new Python dependency is required. `NOTIFICATION_SCHEDULER_ENABLED`
defaults to `true`; set it to `false` for local development or deployments that
must not send scheduled reminders.

The scheduler checks every 30 seconds using `Asia/Colombo`:

- Sunday 08:30: reminder to all active app users
- Sunday 10:25: assigned teachers whose class attendance is missing
- Sunday 10:40: admins, principals and super admins when classes are missing

It retries failed sends and catches up after a restart for 15 minutes after each
time. After that window, the reminder expires rather than arriving hours late.
The backend must be running: keep UptimeRobot monitoring `/api/health` at an
interval shorter than Render's idle timeout. Monitoring does not prevent deploys
or outages; an outage covering the entire retry window will miss that reminder.
Provider/device delivery can still lag behind the backend send time.

Existing `notification_dispatches` rows prevent repeats across workers and
restarts. Claims are committed only after at least one device's push provider
accepts delivery. If every device fails, the claim rolls back for the next retry.
As with any external push API, a crash after acceptance but before the database
commit can result in a repeated notification. Successful provider acceptance is
not a confirmation that a phone displayed the notification.

Deploy these backend changes and check Render logs for `Attendance scheduler
started` and the Sunday phase results. The existing database migration from
section 1 is still required; there is no additional schema migration.

The GitHub workflow now supports **manual dispatch only**, with a phase selector.
It is a fallback, not the automatic clock. For manual dispatch, keep the repository
secret `NOTIFICATION_CRON_SECRET` equal to the backend value. The internal
scheduler does not use that secret. Do not trigger manual runs just to test the
setup: on Sundays they send real notifications.

## 4. Native push credentials

Configure Android FCM and iOS APNs credentials for the existing EAS project, then create and distribute a new native build. `expo-notifications` cannot be added to an already installed binary through a JavaScript-only update.

## 5. User permission

Every user must open Settings once, enable Sunday attendance reminders, and accept the operating system or browser notification prompt. A browser or operating system does not allow the app to bypass this consent.
