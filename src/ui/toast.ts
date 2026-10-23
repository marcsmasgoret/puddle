// A quiet message near the top of the screen that fades by itself
// (skip counts, hints). Never more than one at a time.
let el: HTMLDivElement | null = null;
let timer = 0;

export function toast(html: string, ms = 2600) {
  if (!el) {
    el = document.createElement('div');
    el.className = 'ui-toast';
    document.body.append(el);
  }
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(timer);
  timer = window.setTimeout(() => el?.classList.remove('show'), ms);
}
