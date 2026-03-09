import Link from "next/link";
import { AccountMethodsPanel } from "@/components/auth/account-methods-panel";
import { PageHeader } from "@/components/page-header";
import { SessionManagementPanel } from "@/components/auth/session-management-panel";
import { getAccountMethodSettings } from "@/lib/auth-accounts";
import { getServerSession, getActiveSessions } from "@/lib/session";

function getAccountMethodStatusMessage(statusValue?: string | null) {
  if (!statusValue) {
    return null;
  }

  if (statusValue === "password-set") {
    return "Password sign-in was added to this identity.";
  }

  if (statusValue === "password-changed") {
    return "Password updated.";
  }

  if (statusValue === "password-changed-sessions-reset") {
    return "Password updated and other sessions were revoked.";
  }

  if (statusValue.endsWith("-linked")) {
    const providerLabel = `${statusValue.replace(/-linked$/, "")}`;

    return `${providerLabel.charAt(0).toUpperCase()}${providerLabel.slice(1)} was linked.`;
  }

  if (statusValue.endsWith("-unlinked")) {
    const providerLabel = `${statusValue.replace(/-unlinked$/, "")}`;

    return `${providerLabel.charAt(0).toUpperCase()}${providerLabel.slice(1)} was unlinked.`;
  }

  return null;
}

export default async function SecuritySettingsPage(props: {
  searchParams: Promise<{
    accountError?: string;
    accountStatus?: string;
  }>;
}) {
  const searchParameters = await props.searchParams;
  const session = await getServerSession();
  const activeSessions = await getActiveSessions();
  const accountMethodSettings = await getAccountMethodSettings();

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Security and sessions"
        description="Review active devices, revoke stale sessions, and rotate access without touching the database."
      />

      <AccountMethodsPanel
        availableSocialProviders={accountMethodSettings.availableSocialProviders}
        errorMessage={searchParameters.accountError ?? null}
        hasPasswordAccount={accountMethodSettings.hasPasswordAccount}
        linkedAccounts={accountMethodSettings.linkedAccounts}
        statusMessage={getAccountMethodStatusMessage(searchParameters.accountStatus ?? null)}
      />

      <div className="mt-6">
        <SessionManagementPanel
          activeSessions={activeSessions}
          currentSessionToken={session?.session.token ?? ""}
        />
      </div>

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