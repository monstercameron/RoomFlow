"use client";

import Link from "next/link";
import { useState } from "react";
import {
  buildEmailVerificationCallbackPath,
  buildEmailVerificationPagePath,
  normalizeApplicationPath,
} from "@/lib/auth-urls";

function getVerificationErrorMessage(verificationErrorCode?: string | null) {
  switch (verificationErrorCode) {
    case "CODE_EXPIRED":
      return "That security code expired. Request a fresh verification email below.";
    case "INVALID_CODE":
      return "That security code was not recognized. Paste the newest code from the inbox.";
    case "TOKEN_EXPIRED":
      return "That verification link expired. Request a fresh email below.";
    case "INVALID_TOKEN":
      return "That verification link is invalid. Request a new verification email.";
    case "USER_NOT_FOUND":
      return "This account no longer exists. Create a new operator account to continue.";
    default:
      return verificationErrorCode ? "Verification failed. Request a fresh email below." : null;
  }
}

export function VerifyEmailPanel(props: {
  emailAddress?: string | null;
  nextPath?: string | null;
  verificationErrorCode?: string | null;
  verificationStatus?: "verified" | null;
}) {
  const normalizedNextPath = normalizeApplicationPath(props.nextPath);
  const verificationPagePath = buildEmailVerificationPagePath({
    emailAddress: props.emailAddress,
    nextPath: normalizedNextPath,
  });
  const [emailAddress, setEmailAddress] = useState(props.emailAddress ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    getVerificationErrorMessage(props.verificationErrorCode),
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(
    props.verificationStatus === "verified"
      ? "Email verified. You can continue into the workspace now."
      : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (props.verificationStatus === "verified") {
    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
          {successMessage}
        </div>
        <Link
          className="inline-flex rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white"
          href={normalizedNextPath}
        >
          Continue to workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <form
        className="space-y-4"
        onSubmit={async (submitEvent) => {
          submitEvent.preventDefault();
          setIsSubmitting(true);
          setErrorMessage(null);
          setSuccessMessage(null);

          try {
            const verificationEmailResponse = await fetch("/api/auth/send-verification-email", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: emailAddress,
                callbackURL: buildEmailVerificationCallbackPath({
                  nextPath: normalizedNextPath,
                }),
              }),
            });

            if (!verificationEmailResponse.ok) {
              const errorPayload = (await verificationEmailResponse.json().catch(() => null)) as {
                message?: string;
              } | null;

              setErrorMessage(errorPayload?.message ?? "Unable to send a verification email.");
              return;
            }

            setSuccessMessage(
              "Verification email issued. Open the link from the inbox or paste the security code from that message below.",
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
          {isSubmitting ? "Sending verification email..." : "Send verification email"}
        </button>
        <div className="text-sm text-[var(--color-muted)]">
          Already verified?{" "}
          <Link
            className="font-medium text-[var(--color-accent-strong)]"
            href={buildEmailVerificationPagePath({
              emailAddress,
              nextPath: normalizedNextPath,
            })}
          >
            Refresh this screen after opening the link
          </Link>
          .
        </div>
      </form>

      <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Security code</div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">Paste the 8-character code instead</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
          Every verification email now includes a one-time security code. Paste it here if opening the inbox link is awkward on this device.
        </p>
        <form action="/api/experimental/email-verification-codes/verify" className="mt-4 space-y-4" method="GET">
          <input name="returnTo" type="hidden" value={verificationPagePath} />
          <input name="surface" type="hidden" value="verify-email" />
          <label className="block space-y-2">
            <span className="text-sm font-medium">Security code</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 font-medium uppercase tracking-[0.24em] outline-none"
              inputMode="text"
              name="code"
              placeholder="ABCD-EF12"
              required
              type="text"
            />
          </label>
          <button className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white" type="submit">
            Verify with code
          </button>
        </form>
      </div>
    </div>
  );
}