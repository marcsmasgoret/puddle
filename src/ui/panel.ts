// The settings panel: a small round button in the corner opens a frosted
// glass card. The scene stays clean until it is opened.
import { settings, saveSettings } from './settings';
import { handSpeed } from '../physics/slap';

export interface Panel {
  isOpen(): boolean;
  close(): void;
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
  card.innerHTML = `
    <div class="ui-row">
      <label for="ui-strength">Slap strength</label>
      <span class="ui-value" id="ui-strength-value"></span>
    </div>
    <input id="ui-strength" type="range" min="0" max="1" step="0.01" />
    <div class="ui-scale"><span>gentle</span><span>hard</span></div>
  `;
  document.body.append(button, card);

  const slider = card.querySelector<HTMLInputElement>('#ui-strength')!;
  const value = card.querySelector<HTMLSpanElement>('#ui-strength-value')!;
  slider.value = String(settings.strength);
  const show = () => (value.textContent = `hand ${handSpeed(settings.strength).toFixed(1)} m/s`);
  show();
  slider.addEventListener('input', () => {
    settings.strength = parseFloat(slider.value);
    show();
    saveSettings();
  });

  let open = false;
  const setOpen = (o: boolean) => {
    open = o;
    card.classList.toggle('open', o);
    button.classList.toggle('active', o);
  };
  button.addEventListener('click', () => setOpen(!open));
  return { isOpen: () => open, close: () => setOpen(false) };
}
