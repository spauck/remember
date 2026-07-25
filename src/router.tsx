import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

function normalizeRouterBasepath(baseUrl: string): string {
  if (baseUrl === "/") return "/"

  const withoutTrailingSlash = baseUrl.replace(/\/+$/, "")
  return withoutTrailingSlash.startsWith("/") ? withoutTrailingSlash : `/${withoutTrailingSlash}`
}

export const getRouter = () => {
  const queryClient = new QueryClient()
  const basepath = normalizeRouterBasepath(import.meta.env.BASE_URL ?? "/")

  const router = createRouter({
    routeTree,
    context: { queryClient },
    basepath,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  })

  return router
}
