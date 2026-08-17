import { useEffect, useState } from 'react';
import { shouldUsePwaUi, syncPwaUiClass } from '@/lib/pwaDisplay';

export function usePwaUi() {
  const [enabled, setEnabled] = useState(shouldUsePwaUi);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const fullscreenMode = window.matchMedia('(display-mode: fullscreen)');
    const update = () => setEnabled(syncPwaUiClass());

    update();
    window.addEventListener('resize', update);
    displayMode.addEventListener('change', update);
    fullscreenMode.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      displayMode.removeEventListener('change', update);
      fullscreenMode.removeEventListener('change', update);
    };
  }, []);

  return enabled;
}
