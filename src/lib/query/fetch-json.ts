// Client-side queryFn helper. Route Handlers serialise domain types to JSON,
// which turns `Date` fields into ISO strings. The SSR-hydrated cache, by
// contrast, carries real `Date` objects (preserved through the RSC payload).
// To keep both paths consistent we revive ISO datetime strings back to `Date`
// on every fetch, so components can always call `.toLocaleDateString()` etc.

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function reviveDates(_key: string, value: unknown): unknown {
  if (typeof value === "string" && ISO_DATETIME.test(value)) return new Date(value);
  return value;
}

export async function fetchJson<T>(input: string): Promise<T> {
  const res = await fetch(input, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${input}`);
  }
  const text = await res.text();
  return JSON.parse(text, reviveDates) as T;
}
