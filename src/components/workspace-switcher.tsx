"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

export function WorkspaceSwitcher(props: {
  activeWorkspaceId: string;
  workspaceOptions: Array<{
    membershipRole: string;
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
  }>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (props.workspaceOptions.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs uppercase tracking-[0.24em] text-[rgba(248,243,235,0.55)]">
        Switch workspace
      </label>
      <select
        className="w-full rounded-2xl border border-[rgba(248,243,235,0.14)] bg-[rgba(248,243,235,0.1)] px-4 py-3 text-sm text-[var(--color-sidebar-ink)] outline-none"
        defaultValue={props.activeWorkspaceId}
        disabled={isSubmitting}
        onChange={async (changeEvent) => {
          const nextWorkspaceId = changeEvent.target.value;

          setIsSubmitting(true);
          setErrorMessage(null);

          try {
            const selectionResponse = await fetch("/api/workspaces/active", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                workspaceId: nextWorkspaceId,
              }),
            });

            if (!selectionResponse.ok) {
              const errorPayload = (await selectionResponse.json().catch(() => null)) as {
                message?: string;
              } | null;

              setErrorMessage(errorPayload?.message ?? "Unable to switch workspaces.");
              return;
            }

            startTransition(() => {
              router.refresh();
            });
          } catch {
            setErrorMessage("Network error. Could not switch workspaces.");
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        {props.workspaceOptions.map((workspaceOption) => (
          <option key={workspaceOption.workspaceId} value={workspaceOption.workspaceId}>
            {workspaceOption.workspaceName} ({workspaceOption.membershipRole})
          </option>
        ))}
      </select>
      {errorMessage ? (
        <div className="text-xs text-[rgba(255,219,201,0.9)]">{errorMessage}</div>
      ) : null}
    </div>
  );
}