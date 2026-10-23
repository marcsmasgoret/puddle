// The mute button: always on screen (third round button, top right), so the
// puddle can run quietly while you listen to your own music.
export function createMuteButton(get: () => boolean, set: (muted: boolean) => void) {
  const b = document.createElement('button');
  b.className = 'ui-button ui-button-3';
  const on = `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  const off = `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  const sync = () => {
    b.innerHTML = get() ? off : on;
    b.setAttribute('aria-label', get() ? 'Unmute' : 'Mute');
  };
  b.addEventListener('click', () => {
    set(!get());
    sync();
  });
  sync();
  document.body.append(b);
  return sync;
}
