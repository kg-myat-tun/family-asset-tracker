import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-[2rem] border border-line bg-card p-8 shadow-[0_24px_60px_rgba(31,41,55,0.08)] md:p-10">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-accent">
          Onboarding Placeholder
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          Family creation and invite flows land in Phase 3.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          This route exists now so the app structure is stable before we add the real
          Firebase-backed onboarding flow.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-accent-soft"
          >
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
