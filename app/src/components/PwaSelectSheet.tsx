import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const openSelect = (select: HTMLSelectElement) => {
      if (select.disabled) return;
      const options = Array.from(select.options)
        .filter(option => !option.disabled && !option.hidden)
        .map(option => ({ value: option.value, label: option.textContent?.trim() || option.label }));
      setSheet({ select, title: getTitle(select), value: select.value, options });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const select = (event.target as Element | null)?.closest('select');
      if (!(select instanceof HTMLSelectElement)) return;
      event.preventDefault();
      openSelect(select);
    };

    const handleClick = (event: MouseEvent) => {
      const select = (event.target as Element | null)?.closest('select');
      if (!(select instanceof HTMLSelectElement)) return;
      event.preventDefault();
      openSelect(select);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLSelectElement) || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openSelect(event.target);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [sheet]);

  const choose = (value: string) => {
    if (!sheet?.select.isConnected) {
      setSheet(null);
      return;
    }
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    valueSetter?.call(sheet.select, value);
    sheet.select.dispatchEvent(new Event('change', { bubbles: true }));
    sheet.select.focus({ preventScroll: true });
    setSheet(null);
  };

  if (!sheet) return null;

  return (
    <div className="pwa-select-sheet-layer" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) setSheet(null);
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
