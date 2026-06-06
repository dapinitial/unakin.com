/**
 * <scramble-text phrases="one|two|three" delay="4000">one</scramble-text>
 *
 * Cycles through `phrases` with a glitchy character-scramble transition.
 * The element's light-DOM text (the first phrase) is what crawlers and
 * screen readers see; the animation is presentational only.
 */
const SCRAMBLE_CHARS =
  '?&!╜╛╚╙╘╗╖╕╔╓╒║═┼┴┬┤├┘└┐┌│─[>*]%-.@<}________=):╨╧╦╥╤╣╢╡╠╟;^~#`{(№+╬╫╪╩╞╝';

type QueueItem = {
  from: string;
  to: string;
  start: number;
  end: number;
  char?: string;
};

export class ScrambleText extends HTMLElement {
  #queue: QueueItem[] = [];
  #frame = 0;
  #frameRequest = 0;
  #timeoutId = 0;
  #output!: HTMLSpanElement;
  #resolve: (() => void) | null = null;

  connectedCallback() {
    const phrases = (this.getAttribute('phrases') ?? this.textContent ?? '')
      .split('|')
      .map((p) => p.trim())
      .filter(Boolean);
    const delay = Number(this.getAttribute('delay') ?? 4000);

    // Keep the real text for assistive tech; animate an aria-hidden twin.
    this.setAttribute('aria-label', phrases[0] ?? '');
    this.#output = document.createElement('span');
    this.#output.setAttribute('aria-hidden', 'true');
    this.#output.textContent = this.textContent;
    this.replaceChildren(this.#output);

    if (
      phrases.length < 2 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let counter = 0;
    const next = () => {
      this.#setText(phrases[counter]).then(() => {
        this.#timeoutId = window.setTimeout(() => {
          counter = (counter + 1) % phrases.length;
          next();
        }, delay);
      });
    };
    next();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#frameRequest);
    clearTimeout(this.#timeoutId);
  }

  #setText(newText: string): Promise<void> {
    const oldText = this.#output.textContent ?? '';
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise<void>((resolve) => (this.#resolve = resolve));

    this.#queue = [];
    for (let i = 0; i < length; i++) {
      const start = Math.floor(Math.random() * 40);
      this.#queue.push({
        from: oldText[i] ?? '',
        to: newText[i] ?? '',
        start,
        end: start + Math.floor(Math.random() * 40),
      });
    }

    cancelAnimationFrame(this.#frameRequest);
    this.#frame = 0;
    this.#update();
    return promise;
  }

  #update = () => {
    const fragment = document.createDocumentFragment();
    let complete = 0;

    for (const item of this.#queue) {
      if (this.#frame >= item.end) {
        complete++;
        fragment.append(item.to);
      } else if (this.#frame >= item.start) {
        if (!item.char || Math.random() < 0.28) {
          item.char =
            SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
        const span = document.createElement('span');
        span.className = 'scramble-char';
        span.textContent = item.char;
        fragment.append(span);
      } else {
        fragment.append(item.from);
      }
    }

    this.#output.replaceChildren(fragment);

    if (complete === this.#queue.length) {
      this.#resolve?.();
    } else {
      this.#frameRequest = requestAnimationFrame(this.#update);
      this.#frame++;
    }
  };
}

customElements.define('scramble-text', ScrambleText);
