// Fullscreen toggle: hides the browser's own bars for a more immersive view.
// Phones that don't allow it (iPhone Safari) don't get the button.
export function createFullscreenButton() {
  const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void>; webkitFullscreenElement?: Element };
  const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
  if (!request) return;
  const exit = document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(document);
  const isFull = () => !!(document.fullscreenElement ?? doc.webkitFullscreenElement);

  const b = document.createElement('button');
  b.className = 'ui-button ui-button-2';
  const enterIcon = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const exitIcon = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const sync = () => {
    b.innerHTML = isFull() ? exitIcon : enterIcon;
    b.setAttribute('aria-label', isFull() ? 'Exit full screen' : 'Full screen');
  };
  b.addEventListener('click', () => {
    if (isFull()) exit?.();
    else request({ navigationUI: 'hide' } as FullscreenOptions)?.catch?.(() => {});
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  sync();
  document.body.append(b);
}
