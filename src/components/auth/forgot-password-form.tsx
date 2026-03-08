"use client";

import { useState } from "react";

export function ForgotPasswordForm() {
  const [emailAddress, setEmailAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (submitEvent) => {
        submitEvent.preventDefault();
        setIsSubmitting(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
          const resetRequestResponse = await fetch("/api/auth/request-password-reset", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: emailAddress,
              redirectTo: "/login",
            }),
          });

          if (!resetRequestResponse.ok) {
            const errorPayload = (await resetRequestResponse.json().catch(() => null)) as {
              message?: string;
            } | null;

            setErrorMessage(errorPayload?.message ?? "Unable to request a password reset.");
            return;
          }

          setSuccessMessage(
            "If that email exists, a reset link has been issued. In local development, check the server log when no email provider is configured.",
          );
        } catch {
          setErrorMessage("Network error. Could not reach the server.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium">Email</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(changeEvent) => setEmailAddress(changeEvent.target.value)}
          placeholder="name@roomflow.app"
          type="email"
          value={emailAddress}
        />
      </label>
      {errorMessage ? (
        <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
          {successMessage}
        </div>
      ) : null}
      <button
        className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Sending reset link..." : "Send reset link"}
      </button>
    </form>
  );
}