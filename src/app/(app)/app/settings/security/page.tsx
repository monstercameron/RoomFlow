import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SessionManagementPanel } from "@/components/auth/session-management-panel";
import { getServerSession, getActiveSessions } from "@/lib/session";

export default async function SecuritySettingsPage() {
  const session = await getServerSession();
  const activeSessions = await getActiveSessions();

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Security and sessions"
        description="Review active devices, revoke stale sessions, and rotate access without touching the database."
      />

      <SessionManagementPanel
        activeSessions={activeSessions}
        currentSessionToken={session?.session.token ?? ""}
      />

      <div className="mt-6 text-sm text-[var(--color-muted)]">
        Need integrations instead?{" "}
        <Link className="font-medium text-[var(--color-accent-strong)]" href="/app/settings/integrations">
          Open integrations
        </Link>
        .
      </div>
    </main>
  );
}