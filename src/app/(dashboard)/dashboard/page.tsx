export default function DashboardPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-81px)] w-full max-w-6xl px-6 py-12">
      <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-[2rem] border border-line bg-card p-8 shadow-[0_24px_60px_rgba(31,41,55,0.08)]">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-accent">Dashboard</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
            Family Asset Tracker
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            The protected area is now active. Session-cookie auth is in place, and this route is
            only reachable after Firebase login succeeds and the server verifies the session.
          </p>
        </section>

        <section className="rounded-[2rem] border border-line bg-white p-8">
          <h2 className="text-lg font-semibold text-foreground">Next up in Phase 3</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
            <li>Family creation and join flow</li>
            <li>Asset CRUD with shared family context</li>
            <li>Loan tracking and repayment history</li>
            <li>Member management and onboarding state</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
