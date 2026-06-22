// Central query-key factory. Keys are family-scoped so two families never share
// a cache entry, and so a single `invalidateQueries({ queryKey: keys.assets.all(familyId) })`
// sweeps every variant (filters included). Always build keys through this module
// — never inline array literals at call sites.

// `owner` is a server-side fetch filter (Firestore query). `category` is NOT a
// key dimension — the page filters category in-memory over the fetched list, so
// it stays pure view state and never triggers a separate fetch.
export const keys = {
  assets: {
    all: (familyId: string) => ["assets", familyId] as const,
    list: (familyId: string, owner?: string) =>
      ["assets", familyId, "list", owner ?? null] as const,
    detail: (familyId: string, assetId: string) => ["assets", familyId, "detail", assetId] as const,
  },
  loans: {
    all: (familyId: string) => ["loans", familyId] as const,
    list: (familyId: string) => ["loans", familyId, "list"] as const,
    detail: (familyId: string, loanId: string) => ["loans", familyId, "detail", loanId] as const,
  },
  dashboard: (familyId: string) => ["dashboard", familyId] as const,
  // Ticker suggestions for the asset symbol combobox. Global reference data
  // (not family-scoped) keyed by category + search query.
  assetSymbols: (category: string, query: string) => ["assetSymbols", category, query] as const,
  // Realtime feeds — populated by onSnapshot listeners (not a queryFn), so the
  // cache is shared across components and survives navigation. Notifications are
  // already recipient-filtered server-side, and a browser session is one user,
  // so familyId alone scopes them correctly.
  activity: (familyId: string) => ["activity", familyId] as const,
  notifications: (familyId: string) => ["notifications", familyId] as const,
} as const;
