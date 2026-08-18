import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

interface SheetOption {
  value: string;
  label: string;
}

interface SheetState {
  select: HTMLSelectElement;
  title: string;
  value: string;
  options: SheetOption[];
}

function visibleLabel(element: Element | null) {
  if (!element) return '';
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('select, input, textarea, button').forEach(child => child.remove());
  return copy.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function getTitle(select: HTMLSelectElement) {
  const explicit = select.dataset.sheetTitle || select.getAttribute('aria-label');
  if (explicit) return explicit;

  if (select.id) {
    const label = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
    const text = visibleLabel(label);
    if (text) return text;
  }

  const wrapped = visibleLabel(select.closest('label'));
  if (wrapped) return wrapped;

  const previous = visibleLabel(select.previousElementSibling);
  if (previous) return previous;

  return select.name
    ? select.name.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
    : 'Select option';
}

export default function PwaSelectSheet() {
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const hasSheetHistoryEntry = useRef(false);
  const ignoreOptionClicksUntil = useRef(0);

  const dismissSheet = useCallback(() => {
    setSheet(null);
    if (hasSheetHistoryEntry.current) {
      hasSheetHistoryEntry.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const closeFromBrowserBack = () => {
      if (!hasSheetHistoryEntry.current) return;
      hasSheetHistoryEntry.current = false;
      setSheet(null);
    };

    window.addEventListener('popstate', closeFromBrowserBack);
    return () => window.removeEventListener('popstate', closeFromBrowserBack);
  }, []);

  useEffect(() => {
    let pendingSelect: HTMLSelectElement | null = null;
    let pendingPointerId: number | null = null;

    const openSelect = (select: HTMLSelectElement) => {
      if (select.disabled) return;
      const options = Array.from(select.options)
        .filter(option => !option.disabled && !option.hidden)
        .map(option => ({ value: option.value, label: option.textContent?.trim() || option.label }));
      if (!hasSheetHistoryEntry.current) {
        window.history.pushState(
          { ...(window.history.state || {}), ahadiyaOverlay: 'select-sheet' },
          '',
          window.location.href,
        );
        hasSheetHistoryEntry.current = true;
      }
      setSheet({ select, title: getTitle(select), value: select.value, options });
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const dateInput = target?.closest('input[type="date"]');
      if (dateInput instanceof HTMLInputElement && typeof dateInput.showPicker === 'function') {
        try {
          // Invoke the Android picker exactly once from the trusted click.
          // Preventing the browser's second default invocation avoids the
          // open-then-immediately-close behavior seen in installed PWAs.
          dateInput.showPicker();
          event.preventDefault();
          event.stopPropagation();
        } catch {
          // Fall through to the browser's native default when showPicker is
          // unavailable for the current platform or activation state.
        }
        return;
      }

      const select = target?.closest('select');
      if (!(select instanceof HTMLSelectElement)) return;
      event.preventDefault();
      event.stopPropagation();
      openSelect(select);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      const target = event.target as Element | null;
      const select = target?.closest('select');
      if (!(select instanceof HTMLSelectElement) || select.disabled) return;

      // Android opens its native select UI before the later click event, so
      // cancel that action immediately. Wait for this pointer to be released
      // before mounting our sheet; otherwise the release can touch through
      // and choose whichever option appears beneath the finger.
      event.preventDefault();
      event.stopPropagation();
      pendingSelect = select;
      pendingPointerId = event.pointerId;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (pendingPointerId !== event.pointerId || !pendingSelect) return;
      const select = pendingSelect;
      pendingSelect = null;
      pendingPointerId = null;
      event.preventDefault();
      event.stopPropagation();
      ignoreOptionClicksUntil.current = window.performance.now() + 250;
      if (select.isConnected) openSelect(select);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (pendingPointerId !== event.pointerId) return;
      pendingSelect = null;
      pendingPointerId = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLSelectElement) || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openSelect(event.target);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', handlePointerCancel, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('pointercancel', handlePointerCancel, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissSheet();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [dismissSheet, sheet]);

  const choose = (value: string) => {
    if (window.performance.now() < ignoreOptionClicksUntil.current) return;
    if (!sheet?.select.isConnected) {
      dismissSheet();
      return;
    }
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    valueSetter?.call(sheet.select, value);
    sheet.select.dispatchEvent(new Event('change', { bubbles: true }));
    sheet.select.focus({ preventScroll: true });
    dismissSheet();
  };

  if (!sheet) return null;

  return (
    <div className="pwa-select-sheet-layer" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) dismissSheet();
    }}>
      <section className="pwa-select-sheet" role="dialog" aria-modal="true" aria-label={sheet.title}>
        <div className="pwa-select-sheet-handle" />
        <h2>{sheet.title}</h2>
        <div className="pwa-select-sheet-options">
          {sheet.options.map(option => {
            const selected = option.value === sheet.value;
            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                className={selected ? 'selected' : ''}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {selected && <span className="pwa-select-sheet-check"><Check aria-hidden="true" /></span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
