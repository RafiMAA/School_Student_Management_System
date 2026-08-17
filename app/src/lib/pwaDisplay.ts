const PWA_UI_MAX_WIDTH = 820;

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function isInstalledPwa() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true
  );
}

export function shouldUsePwaUi() {
  if (typeof window === 'undefined') return false;
  // Mobile browsers and installed mobile PWAs share the native-style shell.
  // Wide desktop browser and installed desktop-PWA windows retain the PC UI.
  return window.innerWidth <= PWA_UI_MAX_WIDTH;
}

export function syncPwaUiClass() {
  const enabled = shouldUsePwaUi();
  document.documentElement.classList.toggle('pwa-ui', enabled);
  return enabled;
}
