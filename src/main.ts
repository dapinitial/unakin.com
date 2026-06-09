import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './components/gradient-blob';
import './components/wait-list';

// three.js is the heavy dependency — load the heart lazily so the static
// content paints immediately.
import('./components/heart-model');

gsap.registerPlugin(ScrollTrigger);

// Fade the banner out as it scrolls away.
gsap.fromTo(
  '.banner',
  { opacity: 1 },
  {
    opacity: 0,
    scrollTrigger: {
      trigger: '.banner',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  }
);

// Reveal the definition only as you scroll into the lore section.
gsap.from('.definition', {
  opacity: 0,
  y: 40,
  scrollTrigger: {
    trigger: '.lore',
    start: 'top 85%',
    end: 'top 45%',
    scrub: true,
  },
});

// Hero state machine: prompt (join) ↔ done (just joined) ↔ member (returning).
// "Joined" is remembered in localStorage so returning visitors are greeted
// rather than re-asked.
const JOINED_KEY = 'unakin:joined';
const banner = document.querySelector<HTMLElement>('.banner');

if (banner) {
  const resetForm = () =>
    document
      .querySelector('wait-list')
      ?.dispatchEvent(new CustomEvent('waitlist:reset'));

  const setJoined = (joined: boolean) => {
    try {
      if (joined) localStorage.setItem(JOINED_KEY, '1');
      else localStorage.removeItem(JOINED_KEY);
    } catch {
      /* storage blocked — degrade to per-session behaviour */
    }
  };

  // Backstop for the inline pre-paint check (e.g. if it was blocked).
  try {
    if (banner.dataset.state !== 'done' && localStorage.getItem(JOINED_KEY)) {
      banner.dataset.state = 'member';
    }
  } catch {
    /* ignore */
  }

  banner.addEventListener('waitlist:success', () => {
    setJoined(true);
    banner.dataset.state = 'done';
    ScrollTrigger.refresh();
  });

  banner
    .querySelector<HTMLButtonElement>('[data-action="go-back"]')
    ?.addEventListener('click', () => {
      banner.dataset.state = 'prompt';
      resetForm();
      ScrollTrigger.refresh();
    });

  banner
    .querySelector<HTMLButtonElement>('[data-action="forget-me"]')
    ?.addEventListener('click', () => {
      setJoined(false);
      banner.dataset.state = 'prompt';
      resetForm();
      ScrollTrigger.refresh();
    });
}
