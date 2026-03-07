"use client";

import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("test@roomflow.local");
  const [password, setPassword] = useState("Roomflow123!");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);

        const response = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
            password,
          }),
        });

        setPending(false);

        if (response.ok) {
          window.location.assign("/app");
          return;
        }

        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;

        setError(result?.message ?? "Unable to sign in.");
      }}
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium">Email</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@roomflow.app"
          type="email"
          value={email}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Password</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          type="password"
          value={password}
        />
      </label>
      {error ? (
        <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          {error}
        </div>
      ) : null}
      <button
        className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in..." : "Log in"}
      </button>
    </form>
  );
}
