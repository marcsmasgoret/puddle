// The settings panel: a small round button in the corner opens a frosted
// glass card. The scene stays clean until it is opened.
import { settings, saveSettings } from './settings';
import { handSpeed } from '../physics/slap';
import { registerCard } from './cards';

export interface Panel {
  isOpen(): boolean;
  close(): void;
  /** a row of choice chips; returns a function to update the selection */
  addChoice<T extends string>(label: string, options: [T, string][], get: () => T, set: (v: T) => void): (v: T) => void;
  addSlider(label: string, get: () => number, set: (v: number) => void, readout: (v: number) => string, ends: [string, string]): void;
  addButtons(buttons: [string, () => void][]): HTMLButtonElement[];
  el: HTMLElement;
}

export function createPanel(): Panel {
  const button = document.createElement('button');
  button.className = 'ui-button';
  button.setAttribute('aria-label', 'Settings');
  button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="16" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <circle cx="10" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;

  const card = document.createElement('div');
  card.className = 'ui-panel';
  document.body.append(button, card);

  let open = false;
  const setOpen = (o: boolean) => {
    if (o) one.opening();
    open = o;
    card.classList.toggle('open', o);
    button.classList.toggle('active', o);
    one.sync();
  };
  const one = registerCard({ isOpen: () => open, close: () => setOpen(false) });
  button.addEventListener('click', () => setOpen(!open));

  const panel: Panel = {
    el: card,
    isOpen: () => open,
    close: () => setOpen(false),

    addChoice(label, options, get, set) {
      const row = document.createElement('div');
      row.className = 'ui-section';
      row.innerHTML = `<div class="ui-label">${label}</div><div class="ui-chips"></div>`;
      const chips = row.querySelector('.ui-chips')!;
      const els = options.map(([value, text]) => {
        const b = document.createElement('button');
        b.className = 'ui-chip';
        b.textContent = text;
        b.addEventListener('click', () => {
          set(value);
          mark(value);
        });
        chips.append(b);
        return { value, b };
      });
      const mark = (v: string) => els.forEach((e) => e.b.classList.toggle('on', e.value === v));
      mark(get());
      card.append(row);
      return mark;
    },

    addSlider(label, get, set, readout, ends) {
      const row = document.createElement('div');
      row.className = 'ui-section';
      row.innerHTML = `
        <div class="ui-row"><span class="ui-label">${label}</span><span class="ui-value"></span></div>
        <input type="range" min="0" max="1" step="0.01" />
        <div class="ui-scale"><span>${ends[0]}</span><span>${ends[1]}</span></div>`;
      const input = row.querySelector('input')!;
      const value = row.querySelector<HTMLSpanElement>('.ui-value')!;
      input.value = String(get());
      value.textContent = readout(get());
      input.addEventListener('input', () => {
        set(parseFloat(input.value));
        value.textContent = readout(get());
      });
      card.append(row);
    },

    addButtons(buttons) {
      const row = document.createElement('div');
      row.className = 'ui-section ui-buttons';
      const els = buttons.map(([text, fn]) => {
        const b = document.createElement('button');
        b.className = 'ui-chip ui-action';
        b.textContent = text;
        b.addEventListener('click', fn);
        row.append(b);
        return b;
      });
      card.append(row);
      return els;
    },
  };

  panel.addSlider(
    'Slap strength',
    () => settings.strength,
    (v) => {
      settings.strength = v;
      saveSettings();
    },
    (v) => `hand ${handSpeed(v).toFixed(1)} m/s`,
    ['gentle', 'hard'],
  );
  return panel;
}
