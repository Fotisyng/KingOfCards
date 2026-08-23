import type { AppRouter } from "@kingofcards/api";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

export const queryClient = new QueryClient();

// VITE_API_URL is baked in at build time (prod: relative "/trpc", nginx-proxied; dev: the Fastify server directly).
// Exported directly so imperative call sites (the offline queue flush) can call `.mutate()` outside a React Query hook.
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_API_URL ?? "http://localhost:3001/trpc",
      // Session auth is a cookie, needed even same-origin in prod, and required cross-origin in
      // local dev (Vite on :5173 talking to the Fastify dev server on :3001). This version of
      // httpBatchLink only exposes a custom `fetch`, not a `fetchOptions` passthrough.
      fetch: (url, options) => fetch(url, { ...options, credentials: "include" }),
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
