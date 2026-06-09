import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getOptionalUser } from "@/lib/auth.server";

export default async function LoginPage() {
  const user = await getOptionalUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Family Asset Tracker</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your family dashboard</p>
        </div>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
