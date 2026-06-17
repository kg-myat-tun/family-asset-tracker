import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getOptionalUser } from "@/lib/auth.server";
import { getServerI18n } from "@/lib/i18n/server";

export default async function LoginPage() {
  const user = await getOptionalUser();

  if (user) {
    redirect("/dashboard");
  }

  const { dict } = await getServerI18n();

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">{dict.auth.appName}</h1>
          <p className="mt-1 text-sm text-muted">{dict.auth.signInSubtitle}</p>
        </div>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
