import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getOptionalUser } from "@/lib/auth.server";

export default async function LoginPage() {
  const user = await getOptionalUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16">
      <section className="grid w-full gap-10 rounded-[2rem] border border-line bg-card/90 p-8 shadow-[0_30px_80px_rgba(31,41,55,0.08)] backdrop-blur md:grid-cols-[1.05fr_0.95fr] md:p-12">
        <div className="space-y-5">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-accent">
            Secure family finance access
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Sign in to manage the numbers your family actually shares.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted md:text-lg">
            Phase 2 is live: Firebase Authentication now exchanges browser auth for a server-side
            session cookie, so protected routes stay locked down without exposing sensitive access
            to the client.
          </p>
          <ul className="space-y-3 text-sm leading-6 text-muted">
            <li>Email/password sign-in creates a secure session cookie</li>
            <li>Google sign-in follows the same server-side session flow</li>
            <li>Refreshing protected pages keeps the user signed in</li>
          </ul>
        </div>

        <div className="rounded-[1.5rem] border border-line bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-foreground">Family Asset Tracker</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Sign in to continue to your family dashboard.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
