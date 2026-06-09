/**
 * <wait-list endpoint="/api/signup"> — email capture for the unakin waitlist.
 *
 * OPSEC by construction:
 *  - collects only an email; no cookies, no analytics, no third-party requests
 *  - icons are inline SVG (an icon CDN would leak every visitor's IP)
 *  - a honeypot field (`company`) traps bots; humans never see it
 *  - the server hashes IPs, rate-limits, and never reveals if an email is
 *    already on the list — so this form can't be used to enumerate members
 *
 * The privacy chips make three literally-true claims: replies land in a
 * Proton-encrypted inbox, we store only your email, and nothing on this page
 * talks to a third party.
 */
const LOCK_ICON = /* html */ `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/>
  </svg>`;

const MAIL_ICON = /* html */ `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.6"/>
  </svg>`;

const NOTRACK_ICON = /* html */ `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M6.5 6.5 17.5 17.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
  </svg>`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class WaitList extends HTMLElement {
  #abort = new AbortController();

  connectedCallback() {
    const endpoint = this.getAttribute('endpoint') ?? '/api/signup';

    this.innerHTML = /* html */ `
      <form class="waitlist" novalidate>
        <div class="waitlist-row">
          <label class="visually-hidden" for="wl-email">Email address</label>
          <input
            id="wl-email"
            type="email"
            name="email"
            inputmode="email"
            autocomplete="email"
            placeholder="your@email.com"
            required
          />
          <!-- honeypot: off-screen, not focusable, bots fill it -->
          <input
            class="visually-hidden"
            type="text"
            name="company"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
          />
          <button type="submit">be first</button>
        </div>
        <p class="waitlist-status" role="status" aria-live="polite"></p>
        <p class="waitlist-trust">
          <span class="chip">${LOCK_ICON}<a href="https://proton.me" target="_blank" rel="noopener noreferrer">Encrypted comms</a></span>
          <span class="chip">${MAIL_ICON}Email only</span>
          <span class="chip">${NOTRACK_ICON}No tracking</span>
        </p>
      </form>
    `;

    const form = this.querySelector('form')!;
    const input = this.querySelector<HTMLInputElement>('#wl-email')!;
    const honeypot = this.querySelector<HTMLInputElement>('[name="company"]')!;
    const button = this.querySelector('button')!;
    const status = this.querySelector<HTMLParagraphElement>('.waitlist-status')!;

    const setStatus = (msg: string, kind: 'ok' | 'err' | '') => {
      status.textContent = msg;
      status.dataset.kind = kind;
    };

    form.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();
        const email = input.value.trim();

        if (!EMAIL_RE.test(email)) {
          setStatus('That email looks off — mind checking it?', 'err');
          input.focus();
          return;
        }

        button.disabled = true;
        setStatus('Adding you…', '');

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, company: honeypot.value }),
            signal: AbortSignal.timeout(10_000),
          });

          if (res.ok) {
            // Success state replaces the form — no lingering input
            form.innerHTML = /* html */ `
              <p class="waitlist-done">${LOCK_ICON}<span>You're on the list. We'll be in touch from <strong>hello@unakin.com</strong>.</span></p>
            `;
            return;
          }
          if (res.status === 429) {
            setStatus('Easy there — try again in a minute.', 'err');
          } else {
            setStatus('Something hiccuped. Try again?', 'err');
          }
        } catch {
          setStatus('Network trouble — try again?', 'err');
        } finally {
          button.disabled = false;
        }
      },
      { signal: this.#abort.signal }
    );
  }

  disconnectedCallback() {
    this.#abort.abort();
  }
}

customElements.define('wait-list', WaitList);
