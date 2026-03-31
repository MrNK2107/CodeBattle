"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function RegisterPage(): JSX.Element {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/app";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload?.error ?? "Unable to sign up");
      setIsLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    if (result?.error) {
      setError("Registered, but sign-in failed. Try signing in manually.");
      setIsLoading(false);
      return;
    }

    window.location.href = result?.url ?? callbackUrl;
  };

  const handleOAuth = async (provider: "github" | "google") => {
    setIsLoading(true);
    await signIn(provider, { callbackUrl });
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="text-slate-400">Register with email/password or continue with OAuth.</p>
      </div>
      <div className="grid gap-3">
        <button
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:border-primary"
          type="button"
          disabled={isLoading}
          onClick={() => handleOAuth("github")}
        >
          Continue with GitHub
        </button>
        <button
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:border-primary"
          type="button"
          disabled={isLoading}
          onClick={() => handleOAuth("google")}
        >
          Continue with Google
        </button>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Name</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            type="text"
            name="name"
            required
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Email</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            type="email"
            name="email"
            required
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Password</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            type="password"
            name="password"
            minLength={6}
            required
            disabled={isLoading}
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <div className="text-sm text-slate-400">
        Already have an account? <Link className="text-primary" href="/login">Sign in</Link>
      </div>
    </div>
  );
}
