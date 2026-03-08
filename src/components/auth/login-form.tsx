"use client";

import { buildEmailVerificationPagePath } from "@/lib/auth-urls";
import { useState } from "react";

export function LoginForm() {
  const [emailAddress, setEmailAddress] = useState("test@roomflow.local");
  const [passwordValue, setPasswordValue] = useState("Roomflow123!");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setIsPending(true);
        setErrorMessage(null);

        try {
          const signInResponse = await fetch("/api/auth/sign-in/email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: emailAddress,
              password: passwordValue,
              callbackURL: "/onboarding",
            }),
          });

          if (signInResponse.ok) {
            window.location.assign("/app");
            return;
          }

          const errorPayload = (await signInResponse.json().catch(() => null)) as {
            code?: string;
            message?: string;
          } | null;

          if (errorPayload?.code === "EMAIL_NOT_VERIFIED") {
            // Better Auth can reissue verification mail during sign-in, so we route
            // the operator straight to the verification page after the rejection.
            window.location.assign(
              buildEmailVerificationPagePath({
                emailAddress,
                nextPath: "/onboarding",
              }),
            );
            return;
          }

          if (signInResponse.status >= 500) {
            setErrorMessage("Server unavailable. Please check if the database is running.");
            return;
          }

          setErrorMessage(errorPayload?.message ?? "Unable to sign in.");
        } catch {
          setErrorMessage("Network error. Could not reach the server.");
        } finally {
          setIsPending(false);
        }
      }}
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium">Email</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(event) => setEmailAddress(event.target.value)}
          placeholder="name@roomflow.app"
          type="email"
          value={emailAddress}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Password</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(event) => setPasswordValue(event.target.value)}
          placeholder="Enter your password"
          type="password"
          value={passwordValue}
        />
      </label>
      {errorMessage ? (
        <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          {errorMessage}
        </div>
      ) : null}
      <button
        className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in..." : "Log in"}
      </button>
    </form>
  );
}
