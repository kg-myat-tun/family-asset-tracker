"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { loginWithEmail, loginWithGoogle } from "@/lib/auth.client";

export function LoginForm() {
  const { dict } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginWithEmail(email, password);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dict.auth.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dict.auth.googleLoginFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">{dict.auth.email}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={dict.auth.emailPlaceholder}
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">{dict.auth.password}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={dict.auth.passwordPlaceholder}
            autoComplete="current-password"
            required
            className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
        </label>

        {error ? (
          <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? dict.auth.signingIn : dict.auth.signIn}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-line" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-sm text-muted">{dict.auth.or}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        {dict.auth.continueWithGoogle}
      </button>
    </div>
  );
}
