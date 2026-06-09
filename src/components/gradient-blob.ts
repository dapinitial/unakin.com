/**
 * <gradient-blob> — fixed full-viewport animated gradient background, rendered
 * as a single WebGL fragment-shader pass.
 *
 * Replaces the old CSS `filter: blur(40px)` stack, which re-rasterized a
 * full-screen blurred composite every frame and fought the three.js heart for
 * the GPU. Here, six soft colour glows (the original drift/orbit paths plus a
 * cursor-follower) are composited in one cheap shader at half resolution —
 * smooth, mouse-responsive, and effectively free. The CSS gradient on the host
 * remains as the no-WebGL fallback.
 */
const RES_SCALE = 0.5; // soft gradients upscale invisibly; 4x less fill

const VERT = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision mediump float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;

// Palette ported from the original CSS (:root --color1..5 + interactive)
const vec3 BG1 = vec3(8.0, 10.0, 15.0) / 255.0;
const vec3 BG2 = vec3(0.0, 17.0, 32.0) / 255.0;
const vec3 C1 = vec3(18.0, 113.0, 255.0) / 255.0;
const vec3 C2 = vec3(107.0, 74.0, 255.0) / 255.0;
const vec3 C3 = vec3(100.0, 100.0, 255.0) / 255.0;
const vec3 C4 = vec3(50.0, 160.0, 220.0) / 255.0;
const vec3 C5 = vec3(80.0, 47.0, 122.0) / 255.0;
const vec3 CI = vec3(140.0, 100.0, 255.0) / 255.0;

const float TAU = 6.28318530718;

// Soft radial glow — smoothstep falloff mimics the old 40px blur.
float glow(vec2 p, vec2 center, float r) {
  return 1.0 - smoothstep(0.0, 1.0, distance(p, center) / r);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / u_res;
  vec2 c = u_res * 0.5;
  float R = 0.62 * max(u_res.x, u_res.y);

  // ~40deg background gradient between the two base colours
  vec3 col = mix(BG1, BG2, clamp(uv.x * 0.64 + uv.y * 0.77, 0.0, 1.0));

  vec3 g = vec3(0.0);

  // g1 — vertical bob, 30s
  g += C1 * glow(px, c + vec2(0.0, sin(u_time * TAU / 30.0) * u_res.y * 0.45), R) * 0.9;

  // g2 — orbit (reverse), 20s
  float a2 = -u_time * TAU / 20.0;
  g += C2 * glow(px, c + vec2(cos(a2), sin(a2)) * u_res.x * 0.28, R) * 0.9;

  // g3 — wide orbit, 40s, offset start
  float a3 = u_time * TAU / 40.0 + 3.14159;
  g += C3 * glow(px, c + vec2(cos(a3), sin(a3)) * u_res.x * 0.34, R) * 0.85;

  // g4 — horizontal drift, 40s, dimmer
  g += C4 * glow(px, c + vec2(
        sin(u_time * TAU / 40.0) * u_res.x * 0.45,
        cos(u_time * TAU / 40.0) * u_res.y * 0.12), R) * 0.6;

  // g5 — big slow orbit, 20s
  float a5 = u_time * TAU / 20.0;
  g += C5 * glow(px, c + vec2(cos(a5), sin(a5)) * u_res.x * 0.4, R * 1.4) * 0.9;

  // interactive — follows the (eased) cursor
  g += CI * glow(px, u_mouse, R * 0.9) * 0.7;

  // Screen blend: luminous where glows overlap, never harsh-clips
  col = 1.0 - (1.0 - col) * (1.0 - g);

  // Ordered-ish dither to kill banding on the long dark falloffs
  col += (hash(px + fract(u_time)) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class GradientBlob extends HTMLElement {
  #frameId = 0;
  #abort = new AbortController();
  #gl: WebGLRenderingContext | null = null;

  connectedCallback() {
    const canvas = document.createElement('canvas');
    this.appendChild(canvas);

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    // No WebGL → the host's CSS linear-gradient background still shows.
    if (!gl) return;
    this.#gl = gl;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('gradient-blob shader:', gl.getShaderInfoLog(sh));
      }
      return sh;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);

    // Fullscreen triangle
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_res');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio, 2) * RES_SCALE;
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize, { signal: this.#abort.signal });

    // Cursor follow with lazy easing (matches the old interactive blob)
    let curX = window.innerWidth / 2;
    let curY = window.innerHeight * 1.15;
    let tgX = curX;
    let tgY = curY;
    window.addEventListener(
      'mousemove',
      (e) => {
        tgX = e.clientX;
        tgY = e.clientY;
      },
      { signal: this.#abort.signal }
    );

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const start = performance.now();

    const draw = () => {
      curX += (tgX - curX) / 20;
      curY += (tgY - curY) / 20;
      const s = canvas.width / window.innerWidth;
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.uniform2f(uMouse, curX * s, canvas.height - curY * s); // y-down → y-up
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    if (reducedMotion) {
      draw(); // one static frame, no loop
      return;
    }

    const loop = () => {
      // skip work while the tab is hidden
      if (!document.hidden) draw();
      this.#frameId = requestAnimationFrame(loop);
    };
    this.#frameId = requestAnimationFrame(loop);
  }

  disconnectedCallback() {
    this.#abort.abort();
    cancelAnimationFrame(this.#frameId);
    this.#gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.#gl = null;
  }
}

customElements.define('gradient-blob', GradientBlob);
