"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const passwordResetToken = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!passwordResetToken) {
    return (
      <div className="mt-8 rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
        Missing password reset token. Request a new link from the forgot-password page.
      </div>
    );
  }

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (submitEvent) => {
        submitEvent.preventDefault();

        if (newPassword !== confirmPassword) {
          setErrorMessage("Passwords do not match.");
          setSuccessMessage(null);
          return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
          const resetPasswordResponse = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: passwordResetToken,
              newPassword,
            }),
          });

          if (!resetPasswordResponse.ok) {
            const errorPayload = (await resetPasswordResponse.json().catch(() => null)) as {
              message?: string;
            } | null;

            setErrorMessage(errorPayload?.message ?? "Unable to reset the password.");
            return;
          }

          setSuccessMessage("Password updated. You can now return to login with the new password.");
          setNewPassword("");
          setConfirmPassword("");
        } catch {
          setErrorMessage("Network error. Could not reach the server.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium">New password</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(changeEvent) => setNewPassword(changeEvent.target.value)}
          placeholder="Choose a secure password"
          type="password"
          value={newPassword}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Confirm password</span>
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
          onChange={(changeEvent) => setConfirmPassword(changeEvent.target.value)}
          placeholder="Re-enter the new password"
          type="password"
          value={confirmPassword}
        />
      </label>
      {errorMessage ? (
        <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
          {successMessage}{" "}
          <Link className="font-medium text-[var(--color-accent-strong)]" href="/login">
            Return to login
          </Link>
          .
        </div>
      ) : null}
      <button
        className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Updating password..." : "Set new password"}
      </button>
    </form>
  );
}