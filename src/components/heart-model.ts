/**
 * <heart-model> — full-viewport three.js canvas rendering the segmented heart.
 * The heart pumps continuously, tilts toward the cursor, and breaks apart as
 * the page scrolls (GSAP ScrollTrigger scrubbed against document height).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type Transformation = { x: number; y?: number; z: number };

const MODELS = [
  'love.glb',
  'love1.glb',
  'love2.glb',
  'love2a.glb',
  'love3.glb',
  'love4.glb',
  'love5.glb',
];

// Per-part trajectory for the scroll-driven breakup.
const TRANSFORMATIONS: ((progress: number) => Transformation)[] = [
  (p) => ({ x: -p / 0.3, y: p / 0.3, z: -p / 0.3 }),
  (p) => ({ x: -p / 0.3, z: p / 0.3 }),
  (p) => ({ x: p / 0.3, z: p / 0.3 }),
  (p) => ({ x: -p / 0.3, y: p / 0.3, z: p / 0.3 }),
  (p) => ({ x: p / 0.3, y: -p / 0.3, z: p / 0.3 }),
  (p) => ({ x: p / 0.3, z: p / 0.3 }),
  (p) => ({ x: p / 0.3, z: p / 0.3 }),
];

export class HeartModel extends HTMLElement {
  #abort = new AbortController();
  #frameId = 0;
  #renderer: THREE.WebGLRenderer | null = null;
  #scrollTrigger: ScrollTrigger | null = null;
  #pumpTweens: gsap.core.Tween[] = [];

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = /* html */ `
      <style>
        canvas {
          position: fixed;
          inset: 0;
          z-index: 1; /* above gradient, below content */
          pointer-events: none;
        }
      </style>
      <canvas></canvas>
    `;
    const canvas = shadow.querySelector('canvas')!;
    const basePath = this.getAttribute('src') ?? '/models/heart/';
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 3);
    scene.add(camera);

    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const lightPositions: [number, number, number][] = [
      [-20, -0.1, 10],
      [20, 0, 10],
      [-20, 0, 91],
      [1, 3, 0],
      [-1, 3, 0],
    ];
    for (const [x, y, z] of lightPositions) {
      const light = new THREE.DirectionalLight(0xffffff, 0.8);
      light.position.set(x, y, z);
      scene.add(light);
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer = renderer;

    // Cursor-based tilt
    let targetX = 0;
    let targetY = 0;
    window.addEventListener(
      'mousemove',
      (event) => {
        targetX = (event.clientX - window.innerWidth / 2) * 0.005;
        targetY = (event.clientY - window.innerHeight / 2) * 0.005;
      },
      { signal: this.#abort.signal }
    );

    // Load all parts, then wire up the scroll breakup
    const loader = new GLTFLoader();
    const parts: THREE.Object3D[] = [];
    let loadedCount = 0;

    MODELS.forEach((model, index) => {
      loader.load(
        `${basePath}${model}`,
        (gltf) => {
          const obj = gltf.scene;
          obj.scale.setScalar(0.021);
          obj.userData.transformation = TRANSFORMATIONS[index];
          scene.add(obj);
          parts.push(obj);

          if (!reducedMotion) {
            this.#pumpTweens.push(
              gsap.to(obj.scale, {
                x: 0.023,
                y: 0.023,
                z: 0.023,
                repeat: -1,
                yoyo: true,
                duration: 0.5,
                ease: 'power1.inOut',
              })
            );
          }

          if (++loadedCount === MODELS.length) {
            this.#scrollTrigger = ScrollTrigger.create({
              trigger: document.body,
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
              onUpdate: (self) => {
                for (const part of parts) {
                  const config: Transformation =
                    part.userData.transformation(self.progress);
                  part.position.x = config.x;
                  part.position.y = config.y ?? part.position.y;
                  part.position.z = config.z;
                }
              },
            });
          }
        },
        undefined,
        (error) => console.error('Error loading model:', error)
      );
    });

    const animate = () => {
      this.#frameId = requestAnimationFrame(animate);
      for (const part of parts) {
        part.rotation.y += 0.05 * (targetX - part.rotation.y);
        part.rotation.x += 0.05 * (targetY - part.rotation.x);
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      ScrollTrigger.refresh();
    };
    window.addEventListener('resize', handleResize, {
      signal: this.#abort.signal,
    });
    window.addEventListener('orientationchange', handleResize, {
      signal: this.#abort.signal,
    });
  }

  disconnectedCallback() {
    this.#abort.abort();
    cancelAnimationFrame(this.#frameId);
    this.#pumpTweens.forEach((tween) => tween.kill());
    this.#scrollTrigger?.kill();
    this.#renderer?.dispose();
  }
}

customElements.define('heart-model', HeartModel);
