// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config"

function normalizeViteBasePath(basePath: string | undefined): string {
  if (!basePath || basePath === "/") return "/"

  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`
}

const base = normalizeViteBasePath(process.env.BASE_URL)

const isGhPages = process.env.DEPLOY_TARGET === "gh-pages"

export default defineConfig({
  vite: {
    base,
  },
  tanstackStart: {
    prerender: {
      enabled: true,
      crawlLinks: true,
      failOnError: true,
    },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this. Skip for static GitHub Pages builds so prerender can
    // load the default server entry.
    ...(isGhPages ? {} : { server: { entry: "server" } }),
  },
})
