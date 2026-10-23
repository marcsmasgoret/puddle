// "How to play": a small round button that appears for the game modes, with
// a pulsing ring and a little "how to play" tag pointing at it until you have
// opened it once. It opens a card with a looping gesture demo and two or
// three short lines.
import { settings, saveSettings } from './settings';
import { registerCard } from './cards';

export type TutorialMode = 'skip' | 'fish' | 'boat';

interface Lesson {
  title: string;
  lines: string[];
  /** SVG path the demo finger follows (viewBox 0 0 200 120) */
  path: string;
}

const LESSONS: Record<TutorialMode, Lesson> = {
  skip: {
    title: 'Skipping stones',
    lines: [
      'Swipe sideways, fast, like a side-arm throw.',
      'Angle the swipe up a little: about 20° is the magic angle.',
      'Faster swipes throw harder and spin the stone more.',
    ],
    path: 'M 30 95 Q 100 85 175 55',
  },
  fish: {
    title: 'Fishing',
    lines: ['Tap the water to cast.', 'Watch the bobber. Something may nibble.', 'Tap the grass to reel in.'],
    path: 'M 120 70 L 120 70',
  },
  boat: {
    title: 'RC boat',
    lines: ['Drag the stick to drive: up for throttle, sideways to steer.', 'Arrow keys or WASD work too.', 'Go faster than the waves and watch the V-shaped wake.'],
    path: 'M 100 60 L 100 30 L 140 30 L 140 60 L 100 60',
  },
};

export function createTutorial() {
  const btn = document.createElement('button');
  btn.className = 'ui-button ui-help';
  btn.setAttribute('aria-label', 'How to play');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.8v.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></svg>`;
  const tag = document.createElement('div');
  tag.className = 'ui-help-tag';
  tag.textContent = 'how to play';
  const card = document.createElement('div');
  card.className = 'ui-help-card';
  document.body.append(btn, tag, card);
  let mode: TutorialMode | null = null;
  const isOpen = () => card.classList.contains('open');
  const close = () => {
    card.classList.remove('open');
    one.sync();
  };
  const one = registerCard({ isOpen, close });
  const seen = (m: string) => (settings.hintsSeen ?? []).includes('help-' + m);

  const show = (m: TutorialMode | null) => {
    mode = m;
    btn.classList.toggle('show', !!m);
    const fresh = !!m && !seen(m);
    btn.classList.toggle('pulse', fresh);
    tag.classList.toggle('show', fresh);
    close();
  };
  const open = () => {
    if (!mode) return;
    const l = LESSONS[mode];
    card.innerHTML = `
      <div class="ui-help-title">${l.title}</div>
      <svg class="ui-help-demo" viewBox="0 0 200 120" aria-hidden="true">
        <path d="${l.path}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-dasharray="5 6" stroke-linecap="round"/>
        <circle r="9" fill="rgba(255,255,255,0.9)"><animateMotion dur="1.6s" repeatCount="indefinite" path="${l.path}"/></circle>
        <circle r="16" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><animateMotion dur="1.6s" repeatCount="indefinite" path="${l.path}"/><animate attributeName="r" values="9;18;9" dur="1.6s" repeatCount="indefinite"/></circle>
      </svg>
      ${l.lines.map((s) => `<p>${s}</p>`).join('')}
      <button class="ui-chip ui-action ui-help-ok">Got it</button>`;
    one.opening();
    card.classList.add('open');
    one.sync();
    card.querySelector('.ui-help-ok')!.addEventListener('click', close);
    if (!seen(mode)) {
      settings.hintsSeen = [...(settings.hintsSeen ?? []), 'help-' + mode];
      saveSettings();
    }
    btn.classList.remove('pulse');
    tag.classList.remove('show');
  };
  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  return { show, isOpen, close };
}
