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

## 3. Scheduler

In the GitHub repository settings, add Actions secrets:

- `NOTIFICATION_CRON_SECRET`: exactly the same value configured on the backend

The production backend URL is defined in the workflow, so an `AHADIYA_API_URL`
repository secret is no longer required.

The workflow `.github/workflows/attendance-reminders.yml` runs Sundays at these Sri Lanka times:

- 08:30: reminder to all active app users
- 10:25: only assigned teachers whose class attendance is missing
- 10:40: admins, principals and super admins when one or more classes are missing

## 4. Native push credentials

Configure Android FCM and iOS APNs credentials for the existing EAS project, then create and distribute a new native build. `expo-notifications` cannot be added to an already installed binary through a JavaScript-only update.

## 5. User permission

Every user must open Settings once, enable Sunday attendance reminders, and accept the operating system or browser notification prompt. A browser or operating system does not allow the app to bypass this consent.
