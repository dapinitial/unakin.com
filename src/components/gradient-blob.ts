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

const vec3 BG1 = vec3(8.0, 10.0, 15.0) / 255.0;
const vec3 BG2 = vec3(0.0, 17.0, 32.0) / 255.0;
// three distinct hues
const vec3 A = vec3(18.0, 113.0, 255.0) / 255.0;  // blue
const vec3 B = vec3(120.0, 70.0, 255.0) / 255.0;  // violet
const vec3 C = vec3(40.0, 170.0, 200.0) / 255.0;  // teal

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
  float R = 0.4 * min(u_res.x, u_res.y);

  // subtle cursor parallax (varied depth per blob)
  vec2 par = u_mouse - c;

  // three independent drifts — coprime-ish periods so they never sync up
  vec2 pA = c + vec2(sin(u_time / 13.0 * TAU) * u_res.x * 0.30,
                     cos(u_time / 17.0 * TAU) * u_res.y * 0.28) + par * 0.04;
  vec2 pB = c + vec2(sin(u_time / 19.0 * TAU + 2.1) * u_res.x * 0.32,
                     sin(u_time / 11.0 * TAU) * u_res.y * 0.30) + par * 0.09;
  vec2 pC = c + vec2(cos(u_time / 23.0 * TAU) * u_res.x * 0.26,
                     sin(u_time / 15.0 * TAU + 1.0) * u_res.y * 0.27) + par * 0.06;

  // ~40deg dark background gradient — stays visible between the dots
  vec3 col = mix(BG1, BG2, clamp(uv.x * 0.64 + uv.y * 0.77, 0.0, 1.0));

  // additive, moderate intensity → coloured dots, not a white wash
  col += A * glow(px, pA, R) * 0.5;
  col += B * glow(px, pB, R * 1.1) * 0.5;
  col += C * glow(px, pC, R * 0.9) * 0.45;

  // soft-knee tonemap: overlaps roll off smoothly instead of clipping to white
  col = vec3(1.0) - exp(-col * 1.15);

  // dither to kill banding on the dark falloffs
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
