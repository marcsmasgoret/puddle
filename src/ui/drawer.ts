// The toy drawer: a small button on the left opens a glass tray with the
// toys. Drag one out onto the scene to drop it in; tap one to drop it in the
// middle of the puddle; drag a toy back onto the button to put it away.
import type { ToyKind as AnyToy } from '../physics/toyBodies';

/** toys offered in the drawer (the bobber belongs to fishing mode) */
type ToyKind = Exclude<AnyToy, 'bobber'>;

export interface DrawerHandlers {
  /** a drag out of the drawer started (pointer id, client coords) */
  onDragStart(kind: ToyKind, id: number, x: number, y: number): void;
  onDragMove(id: number, x: number, y: number): void;
  onDragEnd(id: number, x: number, y: number): void;
  onTap(kind: ToyKind): void;
  onClear(): void;
}

const ICONS: Record<ToyKind, string> = {
  duck: `<svg viewBox="0 0 48 48" width="40" height="40"><ellipse cx="22" cy="31" rx="15" ry="9" fill="#ffcf2e"/><path d="M8 30c-2-6 2-9 4-9" fill="#ffcf2e"/><circle cx="30" cy="18" r="8" fill="#ffd43a"/><ellipse cx="39" cy="19.5" rx="5" ry="2.2" fill="#ff8a1f"/><circle cx="32" cy="16" r="1.4" fill="#1b1b1f"/></svg>`,
  paperBoat: `<svg viewBox="0 0 48 48" width="40" height="40"><path d="M6 27h36l-8 10H14z" fill="#f6f3ec"/><path d="M6 27h36l-8 10H14z" fill="none" stroke="#c9c3b5" stroke-width="1"/><path d="M15 27l9-14 9 14z" fill="#ebe6da" stroke="#c9c3b5" stroke-width="1"/></svg>`,
  sailboat: `<svg viewBox="0 0 48 48" width="40" height="40"><path d="M8 32h32c-2 5-6 7-16 7S10 37 8 32z" fill="#2f5577"/><rect x="23" y="7" width="1.6" height="25" fill="#a27b52"/><path d="M22.5 9v21H11z" fill="#f4efe2"/><path d="M25.5 12v18h9z" fill="#e9846a"/></svg>`,
  donut: `<svg viewBox="0 0 48 48" width="40" height="40"><ellipse cx="24" cy="27" rx="18" ry="11" fill="#e7b679"/><path d="M6 25c0-6 8-10 18-10s18 4 18 10c-2 3-5 1-7 3s-4 0-6 2-5-1-7 1-4-1-6 0-4-2-6-1-3-2-4-5z" fill="#f58fb4"/><ellipse cx="24" cy="25" rx="7" ry="3.5" fill="#c98d4f"/><path d="M14 20l3 1M30 18l2 2M20 17l3-1M34 23l2-1M12 25l2 1M27 21l3 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M17 23l2-1M25 19l1 2M36 20l-1 2" stroke="#7fd3f2" stroke-width="1.6" stroke-linecap="round"/></svg>`,
};
const NAMES: Record<ToyKind, string> = { duck: 'Rubber duck', paperBoat: 'Paper boat', sailboat: 'Sailboat', donut: 'Beach donut' };

export function createDrawer(h: DrawerHandlers) {
  const button = document.createElement('button');
  button.className = 'ui-button ui-drawer-button';
  button.setAttribute('aria-label', 'Toys');
  button.innerHTML = ICONS.duck.replace('width="40" height="40"', 'width="26" height="26"');

  const tray = document.createElement('div');
  tray.className = 'ui-tray';
  (Object.keys(ICONS) as ToyKind[]).forEach((kind) => {
    const item = document.createElement('div');
    item.className = 'ui-toy';
    item.title = NAMES[kind];
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', NAMES[kind]);
    item.innerHTML = ICONS[kind];
    item.addEventListener('pointerdown', (e) => startDrag(e, kind));
    tray.append(item);
  });
  const clear = document.createElement('button');
  clear.className = 'ui-chip ui-tray-clear';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => h.onClear());
  tray.append(clear);
  document.body.append(button, tray);

  let open = false;
  const setOpen = (o: boolean) => {
    open = o;
    tray.classList.toggle('open', o);
    button.classList.toggle('active', o);
  };
  button.addEventListener('click', () => setOpen(!open));

  function startDrag(e: PointerEvent, kind: ToyKind) {
    e.preventDefault();
    const id = e.pointerId;
    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        dragging = true;
        setOpen(false);
        h.onDragStart(kind, id, ev.clientX, ev.clientY);
      }
      if (dragging) h.onDragMove(id, ev.clientX, ev.clientY);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (dragging) h.onDragEnd(id, ev.clientX, ev.clientY);
      else h.onTap(kind);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  return {
    isOpen: () => open,
    close: () => setOpen(false),
    /** is this screen point over the drawer button (to put a toy away)? */
    isOverButton(x: number, y: number) {
      const r = button.getBoundingClientRect();
      return x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
    },
  };
}
