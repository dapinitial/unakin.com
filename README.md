# unakin.com

Landing page for [unakin.com](https://www.unakin.com) — vanilla TypeScript Web
Components, no framework.

## Stack

- [Vite](https://vite.dev) + TypeScript
- Native Web Components (`<gradient-blob>`, `<scramble-text>`, `<heart-model>`)
- [three.js](https://threejs.org) for the segmented heart model
- [GSAP](https://gsap.com) ScrollTrigger for scroll-driven animation

## Develop

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build to dist/
npm run preview  # serve the production build locally
```

## Deploy

DigitalOcean App Platform is connected to this repo and auto-deploys
`main` on push (build: `npm run build`, output: `dist/`).
