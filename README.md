# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Deploy to GitHub Pages (via GitHub Actions)

This repository includes a workflow at `.github/workflows/deploy-pages.yml` that builds and deploys the app to GitHub Pages on every push to `dev`, and supports manual runs from the Actions tab.

1. Push this repository to GitHub.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to the `main` branch (or run the workflow manually) to publish.

Notes:
- The workflow runs `npm ci` and `npm run build`, then deploys the Vite `dist` directory.
- `vite.config.ts` is configured to automatically use the correct base path for GitHub Pages project sites.
