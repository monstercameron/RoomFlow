"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { ActiveSessionRecord } from "@/lib/session";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDeviceLabel(userAgentValue?: string | null) {
  if (!userAgentValue) {
    return "Unknown device";
  }

  return userAgentValue;
}

function formatTimestamp(timestampValue: Date) {
  return dateTimeFormatter.format(new Date(timestampValue));
}

export function SessionManagementPanel(props: {
  activeSessions: ActiveSessionRecord[];
  currentSessionToken: string;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sessionTokenBeingRevoked, setSessionTokenBeingRevoked] = useState<string | null>(null);
  const [isRevokingOtherSessions, setIsRevokingOtherSessions] = useState(false);

  async function revokeSingleSession(sessionToken: string) {
    setSessionTokenBeingRevoked(sessionToken);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const revokeSessionResponse = await fetch("/api/auth/revoke-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: sessionToken,
        }),
      });

      if (!revokeSessionResponse.ok) {
        const errorPayload = (await revokeSessionResponse.json().catch(() => null)) as {
          message?: string;
        } | null;

        setErrorMessage(errorPayload?.message ?? "Unable to revoke that session.");
        return;
      }

      if (sessionToken === props.currentSessionToken) {
        window.location.assign("/login");
        return;
      }

      setSuccessMessage("Session revoked.");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Network error. Could not reach the server.");
    } finally {
      setSessionTokenBeingRevoked(null);
    }
  }

  async function revokeOtherSessions() {
    setIsRevokingOtherSessions(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const revokeOtherSessionsResponse = await fetch("/api/auth/revoke-sessions", {
        method: "POST",
      });

      if (!revokeOtherSessionsResponse.ok) {
        const errorPayload = (await revokeOtherSessionsResponse.json().catch(() => null)) as {
          message?: string;
        } | null;

        setErrorMessage(errorPayload?.message ?? "Unable to revoke other sessions.");
        return;
      }

      setSuccessMessage("Other active sessions revoked.");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Network error. Could not reach the server.");
    } finally {
      setIsRevokingOtherSessions(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div>
          <div className="text-xl font-semibold">Active sessions</div>
          <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
            Revoke stale devices or sign out the current browser when account access should be rotated.
          </p>
        </div>
        <button
          className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRevokingOtherSessions || props.activeSessions.length <= 1}
          onClick={() => {
            void revokeOtherSessions();
          }}
          type="button"
        >
          {isRevokingOtherSessions ? "Revoking others..." : "Sign out other devices"}
        </button>
      </div>

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

      <div className="space-y-3">
        {props.activeSessions.map((activeSession) => {
          const isCurrentSession = activeSession.token === props.currentSessionToken;
          const isRevokingThisSession = sessionTokenBeingRevoked === activeSession.token;

          return (
            <div
              className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
              key={activeSession.token}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2 text-sm">
                  <div className="text-base font-semibold">
                    {formatDeviceLabel(activeSession.userAgent)}
                  </div>
                  <div className="text-[var(--color-muted)]">
                    {isCurrentSession ? "Current session" : "Active on another device"}
                  </div>
                  <div className="text-[var(--color-muted)]">
                    IP: {activeSession.ipAddress ?? "Unavailable"}
                  </div>
                  <div className="text-[var(--color-muted)]">
                    Started: {formatTimestamp(activeSession.createdAt)}
                  </div>
                  <div className="text-[var(--color-muted)]">
                    Expires: {formatTimestamp(activeSession.expiresAt)}
                  </div>
                </div>
                <button
                  className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={Boolean(sessionTokenBeingRevoked) || isRevokingOtherSessions}
                  onClick={() => {
                    void revokeSingleSession(activeSession.token);
                  }}
                  type="button"
                >
                  {isRevokingThisSession
                    ? "Revoking..."
                    : isCurrentSession
                      ? "End current session"
                      : "Revoke session"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}