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

Pushes to `main` build and deploy to Azure Web App `unakin` via
`.github/workflows/main_unakin.yml`. The Azure publish profile lives in the
repo's GitHub Actions secrets (`AZUREAPPSERVICE_PUBLISHPROFILE`).
