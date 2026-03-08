"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildEmailVerificationPagePath } from "@/lib/auth-urls";
import { authClient } from "@/lib/auth-client";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-8 grid gap-4 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        setMessage(null);

        await authClient.signUp.email(
          {
            name,
            email,
            password,
            callbackURL: "/onboarding",
          },
          {
            onError(context) {
              setError(context.error.message);
            },
            onSuccess() {
              setMessage("Account created. Check your verification email before continuing into the workspace.");
              router.push(
                buildEmailVerificationPagePath({
                  emailAddress: email,
                  nextPath: "/onboarding",
                }),
              );
              router.refresh();
            },
          },
        );

        setPending(false);
      }}
    >
      <label className="space-y-2">
        <span className="text-sm font-medium">Name</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(event) => setName(event.target.value)}
          placeholder="Alex Rivera"
          type="text"
          value={name}
        />
      </label>
      <label className="space-y-2">
        <span className="text-sm font-medium">Email</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="alex@roomflow.app"
          type="email"
          value={email}
        />
      </label>
      <label className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium">Password</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Choose a secure password"
          type="password"
          value={password}
        />
      </label>
      {error ? (
        <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)] md:col-span-2">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)] md:col-span-2">
          {message}
        </div>
      ) : null}
      <button
        className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
        disabled={pending}
        type="submit"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
