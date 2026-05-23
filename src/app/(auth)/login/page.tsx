import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16">
      <section className="grid w-full gap-10 rounded-[2rem] border border-line bg-card/90 p-8 shadow-[0_30px_80px_rgba(31,41,55,0.08)] backdrop-blur md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <div className="space-y-5">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-accent">
            Phase 1 Scaffold
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Family finances, organized around the people who share them.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted md:text-lg">
            Authentication wiring comes in Phase 2. For now, the app shell, shared types, Firebase
            setup, and route structure are in place so we can build the real flows on top of a
            stable foundation.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
            >
              View scaffold
            </Link>
            <Link
              href="/onboarding"
              className="rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-accent-soft"
            >
              Family onboarding preview
            </Link>
          </div>
        </div>

        <aside className="rounded-[1.5rem] border border-line bg-white p-6">
          <p className="text-sm font-semibold text-foreground">What is ready</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
            <li>Next.js 16 App Router scaffold</li>
            <li>Node 24 + pnpm + Biome project baseline</li>
            <li>Firebase client and admin entry points</li>
            <li>Shared domain types and env template</li>
            <li>Route groups for auth, dashboard, assets, loans, and members</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
