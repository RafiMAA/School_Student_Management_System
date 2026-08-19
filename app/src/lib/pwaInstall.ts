export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PWABuildInfo {
  version: string;
  publishedAt: string;
}

export interface PWAUpdateStatus {
  current: PWABuildInfo;
  latest: PWABuildInfo | null;
  updateAvailable: boolean;
}

export const currentPWABuild: PWABuildInfo = {
  version: __AHADIYA_BUILD_VERSION__,
  publishedAt: __AHADIYA_BUILD_PUBLISHED_AT__,
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const UPDATE_NOTIFICATION_KEY = 'ahadiya-update-notified-version';
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
let updateNotificationMonitorStarted = false;

const notify = () => listeners.forEach(listener => listener());

window.addEventListener('beforeinstallprompt', event => {
  // Do not prevent the default browser install UI. Suppressing it made the
  // PWA appear non-installable everywhere except the Settings page. We still
  // retain the event so the explicit in-app Install button can request the
  // prompt in Chromium browsers that allow both entry points.
  deferredPrompt = event as BeforeInstallPromptEvent;
  notify();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  notify();
});

export const canInstallPWA = () => deferredPrompt !== null;

export const subscribeToPWAInstall = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export async function promptPWAInstall() {
  if (!deferredPrompt) return 'unavailable' as const;
  const prompt = deferredPrompt;
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // A BeforeInstallPromptEvent can be used only once, regardless of choice.
    deferredPrompt = null;
    notify();
    return outcome;
  } catch {
    // Some browsers consume the event after showing their own install UI.
    // Clear it so Settings falls back to accurate browser-menu guidance.
    deferredPrompt = null;
    notify();
    return 'unavailable' as const;
  }
}

export const isRunningAsPWA = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

function isPWABuildInfo(value: unknown): value is PWABuildInfo {
  if (!value || typeof value !== 'object') return false;
  const build = value as Partial<PWABuildInfo>;
  return typeof build.version === 'string' && build.version.length > 0
    && typeof build.publishedAt === 'string' && !Number.isNaN(Date.parse(build.publishedAt));
}

export async function checkForPWAUpdate(): Promise<PWAUpdateStatus> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Version check failed');
    const latest: unknown = await response.json();
    if (!isPWABuildInfo(latest)) throw new Error('Invalid version metadata');
    return {
      current: currentPWABuild,
      latest,
      updateAvailable: latest.version !== currentPWABuild.version,
    };
  } catch {
    return { current: currentPWABuild, latest: null, updateAvailable: false };
  }
}

async function notifyIfUpdateAvailable(status: PWAUpdateStatus) {
  if (
    !status.updateAvailable
    || !status.latest
    || !isRunningAsPWA()
    || !('Notification' in window)
    || Notification.permission !== 'granted'
    || !('serviceWorker' in navigator)
    || localStorage.getItem(UPDATE_NOTIFICATION_KEY) === status.latest.version
  ) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('Ahadiya app update available', {
      body: `Version ${status.latest.version} is ready. Tap to open Settings and update.`,
      icon: '/ahadiya-pwa-icon-192.png',
      badge: '/ahadiya-pwa-icon-192.png',
      tag: 'ahadiya-pwa-update',
      data: { url: '/settings', type: 'pwa-update', version: status.latest.version },
    });
    localStorage.setItem(UPDATE_NOTIFICATION_KEY, status.latest.version);
  } catch {
    // A later foreground/online check will retry if the service worker was not ready.
  }
}

/** Check for new builds throughout the installed app's lifetime. */
export function startPWAUpdateNotificationMonitor() {
  if (updateNotificationMonitorStarted || !isRunningAsPWA()) return;
  updateNotificationMonitorStarted = true;

  const check = async () => notifyIfUpdateAvailable(await checkForPWAUpdate());
  const checkWhenVisible = () => {
    if (document.visibilityState === 'visible') void check();
  };

  void check();
  window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', checkWhenVisible);
}

function waitForControllerChange(timeoutMs = 5000) {
  return new Promise<void>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', finish);
      resolve();
    };
    navigator.serviceWorker.addEventListener('controllerchange', finish);
    window.setTimeout(finish, timeoutMs);
  });
}

function waitForWorkerActivation(worker: ServiceWorker, timeoutMs = 30000) {
  if (worker.state === 'activated') return Promise.resolve();
  return new Promise<void>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      worker.removeEventListener('statechange', handleStateChange);
      resolve();
    };
    const handleStateChange = () => {
      if (worker.state === 'activated' || worker.state === 'redundant') finish();
    };
    worker.addEventListener('statechange', handleStateChange);
    window.setTimeout(finish, timeoutMs);
  });
}

export async function applyPWAUpdate() {
  if (!('serviceWorker' in navigator)) throw new Error('Updates are not supported by this browser');

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(registration => registration.update()));
  const nextWorkers = registrations
    .map(registration => registration.waiting ?? registration.installing)
    .filter((worker): worker is ServiceWorker => Boolean(worker));

  if (nextWorkers.length > 0) {
    const controllerChange = waitForControllerChange();
    nextWorkers.forEach(worker => worker.postMessage({ type: 'SKIP_WAITING' }));
    await Promise.all(nextWorkers.map(worker => waitForWorkerActivation(worker)));
    await controllerChange;
  }

  navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_UNUSED_CACHES' });
  window.location.reload();
}
