import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './components/gradient-blob';
import './components/scramble-text';
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
