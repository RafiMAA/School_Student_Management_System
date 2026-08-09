# Al-Meera Ahadiya Mobile App

React Native/Expo mobile client for the existing Ahadiya Student Management System backend. The app is designed for Android and iOS with native stacks, bottom navigation, compact cards, touch-friendly forms, light/dark themes, and persisted authentication.

## Included areas

- Login and secure persisted session
- Dashboard and Sunday submission overview
- Mark attendance and monthly/yearly attendance history
- Student list, filters, profile, add/edit/delete, alumni
- Class list and create/edit/delete
- Academic year management
- Promotion rules, preview, execute, and undo
- Teachers/staff, profiles, role changes, password reset, and deletion
- Audit logs
- User profile, password, appearance, notifications, and logout

## Configure the backend

Copy `.env.example` to `.env` and replace the address with the backend URL reachable from the phone:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000/api
```

Do not use `localhost` on a physical phone. Use the computer's LAN IP and ensure the backend listens on `0.0.0.0`. The Android emulator fallback is `http://10.0.2.2:8000/api`; the iOS simulator fallback is `http://localhost:8000/api`. Production builds should use an HTTPS API URL.

## Run locally

```bash
npm install
npm start
```

Then scan the QR code with Expo Go, or use `npm run android` / `npm run ios`. An iOS simulator requires macOS; a physical iPhone can use Expo Go during development.

## Verify

```bash
npm run typecheck
npm run doctor
```

## Build installable apps

Install and log in to EAS once:

```bash
npm install -g eas-cli
eas login
```

Build an installable Android APK with `npm run build:android:apk`. Build store releases with `npm run build:android` and `npm run build:ios`.

EAS guides Android signing. An Apple Developer account is required to sign and distribute the iOS app. Package identifiers are `lk.almeera.ahadiya`.

For cloud builds, add `EXPO_PUBLIC_API_BASE_URL` to the matching EAS environment as well; a local ignored `.env` file is not a production secret/config source:

```bash
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://your-api.example/api --environment preview
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://your-api.example/api --environment production
```

## Project structure

```text
src/
  components/    Shared mobile UI
  contexts/      Authentication and theme state
  navigation/    Root, tab, and feature stacks
  screens/       App screens grouped by feature
  services/      Backend API client
  types/         Shared application types
```
