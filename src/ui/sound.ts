// The sound button (third round button, top right). It opens a small card
// with separate levels for the music and for the sounds of the place (water,
// animals, weather), and a mute switch, so the puddle can run quietly next
// to your own music.
export interface SoundControls {
  music(): number;
  setMusic(v: number): void;
  sounds(): number;
  setSounds(v: number): void;
  muted(): boolean;
  setMuted(m: boolean): void;
}

const ON = `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const OFF = `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

export function createSoundButton(c: SoundControls) {
  const b = document.createElement('button');
  b.className = 'ui-button ui-button-3';
  const card = document.createElement('div');
  card.className = 'ui-panel ui-sound';
  const slider = (label: string, get: () => number, set: (v: number) => void) => {
    const row = document.createElement('div');
    row.className = 'ui-section';
    row.innerHTML = `<div class="ui-row"><span class="ui-label">${label}</span><span class="ui-value"></span></div><input type="range" min="0" max="1" step="0.01">`;
    const input = row.querySelector('input')!;
    const val = row.querySelector<HTMLElement>('.ui-value')!;
    const show = () => (val.textContent = get() < 0.01 ? 'off' : `${Math.round(get() * 100)} %`);
    input.value = String(get());
    show();
    input.addEventListener('input', () => {
      set(parseFloat(input.value));
      show();
    });
    card.append(row);
  };
  slider('Music', c.music, c.setMusic);
  slider('Nature & effects', c.sounds, c.setSounds);
  const mute = document.createElement('button');
  mute.className = 'ui-chip ui-action';
  card.append(mute);
  const sync = () => {
    b.innerHTML = c.muted() ? OFF : ON;
    b.setAttribute('aria-label', c.muted() ? 'Sound (muted)' : 'Sound');
    mute.textContent = c.muted() ? 'Unmute' : 'Mute everything';
    mute.classList.toggle('on', c.muted());
  };
  mute.addEventListener('click', () => {
    c.setMuted(!c.muted());
    sync();
  });
  let open = false;
  const setOpen = (o: boolean) => {
    open = o;
    card.classList.toggle('open', o);
  };
  b.addEventListener('click', () => setOpen(!open));
  document.body.append(b, card);
  sync();
  return { isOpen: () => open, close: () => setOpen(false) };
}
