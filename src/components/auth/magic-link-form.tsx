"use client";

import Link from "next/link";
import { useState } from "react";
import { buildMagicLinkPagePath, normalizeApplicationPath } from "@/lib/auth-urls";
import type { Workflow1Intent } from "@/lib/workflow1";

function getMagicLinkErrorMessage(errorCode?: string | null) {
  switch (errorCode) {
    case "INVALID_TOKEN":
      return "That magic link is invalid. Request a new sign-in email.";
    case "EXPIRED_TOKEN":
      return "That magic link expired. Request a fresh sign-in email.";
    case "ATTEMPTS_EXCEEDED":
      return "That magic link was already used. Request another sign-in email.";
    case "new_user_signup_disabled":
      return "No account exists for that email yet. Create an account first, then try passwordless sign-in.";
    default:
      return errorCode ? "Magic-link sign-in failed. Request another sign-in email." : null;
  }
}

export function MagicLinkForm(props: {
  emailAddress?: string | null;
  nextPath?: string | null;
  errorCode?: string | null;
  status?: "sent" | null;
  workflow1Intent?: Workflow1Intent;
}) {
  const normalizedNextPath = normalizeApplicationPath(props.nextPath);
  const [emailAddress, setEmailAddress] = useState(props.emailAddress ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    getMagicLinkErrorMessage(props.errorCode),
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(
    props.status === "sent"
      ? "Magic link issued. In local development, check the server log if no email provider is configured."
      : null,
  );
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
          const magicLinkResponse = await fetch("/api/auth/sign-in/magic-link", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: emailAddress,
              callbackURL: normalizedNextPath,
              errorCallbackURL: buildMagicLinkPagePath({
                emailAddress,
                inviteToken: props.workflow1Intent?.inviteToken,
                nextPath: normalizedNextPath,
                plan: props.workflow1Intent?.plan,
                source: props.workflow1Intent?.source,
                utmCampaign: props.workflow1Intent?.utmCampaign,
              }),
            }),
          });

          if (!magicLinkResponse.ok) {
            const errorPayload = (await magicLinkResponse.json().catch(() => null)) as {
              message?: string;
            } | null;

            setErrorMessage(errorPayload?.message ?? "Unable to send a magic link.");
            return;
          }

          setSuccessMessage(
            "Magic link issued. In local development, check the server log if no email provider is configured.",
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
        {isSubmitting ? "Sending magic link..." : "Email me a sign-in link"}
      </button>
      <div className="text-sm text-[var(--color-muted)]">
        Prefer a password instead?{" "}
        <Link className="font-medium text-[var(--color-accent-strong)]" href="/login">
          Return to login
        </Link>
        .
      </div>
    </form>
  );
}