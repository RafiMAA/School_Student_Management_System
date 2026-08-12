export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

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
