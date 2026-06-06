/**
 * <gradient-blob> — fixed full-viewport animated gradient background with a
 * goo-filtered blob that lazily follows the cursor.
 */
export class GradientBlob extends HTMLElement {
  #frameId = 0;
  #abort = new AbortController();

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = /* html */ `
      <style>
        :host {
          position: fixed;
          inset: 0;
          overflow: hidden;
          background: linear-gradient(40deg, var(--color-bg1, #080a0f), var(--color-bg2, #001120));
          z-index: 0; /* behind the heart canvas */

          --color1: 18, 113, 255;
          --color2: 107, 74, 255;
          --color3: 100, 100, 255;
          --color4: 50, 160, 220;
          --color5: 80, 47, 122;
          --color-interactive: 140, 100, 255;
          --circle-size: 80%;
          --blending: hard-light;
        }

        .noise {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          mix-blend-mode: soft-light;
          opacity: 0.3;
        }

        .defs {
          display: none;
        }

        .gradients {
          filter: url(#goo) blur(40px);
          width: 100%;
          height: 100%;
        }

        .gradients > div {
          position: absolute;
          mix-blend-mode: var(--blending);
          width: var(--circle-size);
          height: var(--circle-size);
          top: calc(50% - var(--circle-size) / 2);
          left: calc(50% - var(--circle-size) / 2);
        }

        .g1 {
          background: radial-gradient(circle at center, rgba(var(--color1), 0.8) 0, rgba(var(--color1), 0) 50%) no-repeat;
          transform-origin: center center;
          animation: move-vertical 30s ease infinite;
        }

        .g2 {
          background: radial-gradient(circle at center, rgba(var(--color2), 0.8) 0, rgba(var(--color2), 0) 50%) no-repeat;
          transform-origin: calc(50% - 400px);
          animation: move-in-circle 20s reverse infinite;
        }

        .g3 {
          background: radial-gradient(circle at center, rgba(var(--color3), 0.8) 0, rgba(var(--color3), 0) 50%) no-repeat;
          top: calc(50% - var(--circle-size) / 2 + 200px);
          left: calc(50% - var(--circle-size) / 2 - 500px);
          transform-origin: calc(50% + 400px);
          animation: move-in-circle 40s linear infinite;
        }

        .g4 {
          background: radial-gradient(circle at center, rgba(var(--color4), 0.8) 0, rgba(var(--color4), 0) 50%) no-repeat;
          transform-origin: calc(50% - 200px);
          animation: move-horizontal 40s ease infinite;
          opacity: 0.7;
        }

        .g5 {
          background: radial-gradient(circle at center, rgba(var(--color5), 0.8) 0, rgba(var(--color5), 0) 50%) no-repeat;
          width: calc(var(--circle-size) * 2);
          height: calc(var(--circle-size) * 2);
          top: calc(50% - var(--circle-size));
          left: calc(50% - var(--circle-size));
          transform-origin: calc(50% - 800px) calc(50% + 200px);
          animation: move-in-circle 20s ease infinite;
        }

        .interactive {
          background: radial-gradient(circle at center, rgba(var(--color-interactive), 0.8) 0, rgba(var(--color-interactive), 0) 50%) no-repeat;
          width: 100%;
          height: 100%;
          top: -50%;
          left: -50%;
          opacity: 0.7;
        }

        @keyframes move-in-circle {
          0% { transform: rotate(0deg); }
          50% { transform: rotate(180deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes move-vertical {
          0% { transform: translateY(-50%); }
          50% { transform: translateY(50%); }
          100% { transform: translateY(-50%); }
        }

        @keyframes move-horizontal {
          0% { transform: translateX(-50%) translateY(-10%); }
          50% { transform: translateX(50%) translateY(10%); }
          100% { transform: translateX(-50%) translateY(-10%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .gradients > div {
            animation: none;
          }
        }
      </style>

      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="noise" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <filter id="noise-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise-filter)" />
      </svg>

      <svg xmlns="http://www.w3.org/2000/svg" class="defs" aria-hidden="true">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div class="gradients">
        <div class="g1"></div>
        <div class="g2"></div>
        <div class="g3"></div>
        <div class="g4"></div>
        <div class="g5"></div>
        <div class="interactive"></div>
      </div>
    `;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const blob = shadow.querySelector<HTMLDivElement>('.interactive')!;
    let curX = 0;
    let curY = 0;
    let tgX = 0;
    let tgY = 0;

    const move = () => {
      curX += (tgX - curX) / 20;
      curY += (tgY - curY) / 20;
      blob.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
      this.#frameId = requestAnimationFrame(move);
    };

    window.addEventListener(
      'mousemove',
      (event) => {
        tgX = event.clientX;
        tgY = event.clientY;
      },
      { signal: this.#abort.signal }
    );

    this.#frameId = requestAnimationFrame(move);
  }

  disconnectedCallback() {
    this.#abort.abort();
    cancelAnimationFrame(this.#frameId);
  }
}

customElements.define('gradient-blob', GradientBlob);
