# PawPavement

A small Vite React TypeScript starter for a pet-walking web app. It is frontend
only, mobile-first, and prepared for GitHub Pages deployment.

## Scripts

- `npm run dev` starts the local Vite development server.
- `npm run build` type-checks the app and creates the production build in
  `dist`.
- `npm run preview` serves the production build locally.

## GitHub Pages

This project includes a GitHub Actions workflow at
`.github/workflows/deploy.yml`. Pushes to `main` will install dependencies,
build the app, and deploy the `dist` folder to GitHub Pages.
