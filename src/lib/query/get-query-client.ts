import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import { cache } from "react";

// Shared QueryClient factory. Defaults err on the side of fewer refetches: this
// app's source of truth is Firestore via Server Actions, so background churn is
// undesirable. Mutations drive invalidation explicitly.
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        // Include pending queries so streamed prefetches hydrate on the client.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// Server: a fresh client per request (memoised by React `cache()` so a single
// request reuses one client across prefetches). Browser: a module singleton so
// the cache persists across client navigations.
const getServerQueryClient = cache(() => makeQueryClient());

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return getServerQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
