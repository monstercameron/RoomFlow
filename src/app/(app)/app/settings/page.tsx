import Link from "next/link";
import { WorkspacePlanType } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import {
  transferBillingOwnerAction,
  updateWorkspacePlanAction,
} from "@/app/(app)/app/settings/plan-actions";
import {
  getCurrentWorkspaceState,
  getWorkspaceBillingOwnerTransferData,
  getWorkspacePlanUsageData,
} from "@/lib/app-data";
import {
  formatWorkspaceCapabilityLabel,
  getLockedCapabilitiesForWorkspacePlan,
  getMinimumWorkspacePlanForCapability,
  getWorkspacePlanUsageLimits,
  formatWorkspacePlanLabel,
  formatWorkspacePlanStatusLabel,
} from "@/lib/workspace-plan";

function getUpgradePromptCopy(upgradeCapability?: string) {
  if (upgradeCapability === "org-members") {
    return {
      description:
        "Shared teammate access, invite flows, and member-management controls are reserved for Org workspaces.",
      title: "Upgrade to unlock teammate access",
    };
  }

  if (upgradeCapability === "whatsapp-messaging") {
    return {
      description:
        "WhatsApp conversation support is limited to Org workspaces because it depends on the advanced messaging integration set.",
      title: "Upgrade to unlock WhatsApp messaging",
    };
  }

  if (upgradeCapability === "instagram-messaging") {
    return {
      description:
        "Instagram business messaging is limited to Org workspaces because it depends on the advanced messaging integration set.",
      title: "Upgrade to unlock Instagram messaging",
    };
  }

  return null;
}

function getPlanChangeMessage(planChange?: string) {
  if (planChange === "downgraded") {
    return "Workspace downgraded safely. Unsupported features were disabled, but existing data was left intact.";
  }

  if (planChange === "upgraded") {
    return "Workspace upgraded. Org capabilities are now enabled for this workspace.";
  }

  if (planChange === "updated") {
    return "Workspace plan updated.";
  }

  if (planChange === "billing-owner-transferred") {
    return "Billing ownership transferred to another eligible workspace admin.";
  }

  if (planChange === "billing-owner-unchanged") {
    return "Billing ownership could not be changed with the current selection.";
  }

  return null;
}

function formatUsageLimit(limitValue: number | null) {
  return limitValue === null ? "No cap" : String(limitValue);
}

export default async function SettingsPage(props: {
  searchParams: Promise<{
    planChange?: string;
    upgrade?: string;
  }>;
}) {
  const workspaceState = await getCurrentWorkspaceState();
  const searchParameters = await props.searchParams;
  const lockedCapabilities = getLockedCapabilitiesForWorkspacePlan(workspaceState.workspace.planType);
  const upgradePromptCopy = getUpgradePromptCopy(searchParameters.upgrade);
  const planChangeMessage = getPlanChangeMessage(searchParameters.planChange);
  const workspaceBillingOwnerTransferData = await getWorkspaceBillingOwnerTransferData();
  const workspacePlanUsageData = await getWorkspacePlanUsageData();
  const workspacePlanUsageLimits = getWorkspacePlanUsageLimits(workspaceState.workspace.planType);

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Operator and workspace settings"
        description="The settings area now carries the minimum account, workspace, and integration context needed for the single-operator v1 flow."
      />

      {upgradePromptCopy ? (
        <div className="mb-4 rounded-[2rem] border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold text-[var(--color-accent-strong)]">
            {upgradePromptCopy.title}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            {upgradePromptCopy.description}
          </p>
        </div>
      ) : null}
      {planChangeMessage ? (
        <div className="mb-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm font-medium text-[var(--color-ink)]">{planChangeMessage}</div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Profile</div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Name</dt>
              <dd className="mt-1 font-medium">{workspaceState.user.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Email</dt>
              <dd className="mt-1 font-medium">{workspaceState.user.email}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Role</dt>
              <dd className="mt-1 font-medium">{workspaceState.membership.role}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Workspace</div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Workspace name</dt>
              <dd className="mt-1 font-medium">{workspaceState.workspace.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Slug</dt>
              <dd className="mt-1 font-medium">{workspaceState.workspace.slug}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Onboarding</dt>
              <dd className="mt-1 font-medium">
                {workspaceState.onboardingComplete ? "Complete" : "In progress"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Plan</div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Package</dt>
              <dd className="mt-1 font-medium">
                {formatWorkspacePlanLabel(workspaceState.workspace.planType)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Status</dt>
              <dd className="mt-1 font-medium">
                {formatWorkspacePlanStatusLabel(workspaceState.workspace.planStatus)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Billing owner</dt>
              <dd className="mt-1 font-medium">
                {workspaceState.workspace.billingOwner?.email ?? "Unassigned"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Enabled capabilities</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {workspaceState.workspace.enabledCapabilities.map((workspaceCapability) => (
                  <span
                    className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]"
                    key={workspaceCapability}
                  >
                    {formatWorkspaceCapabilityLabel(workspaceCapability)}
                  </span>
                ))}
              </dd>
            </div>
            {workspaceState.workspace.planType === WorkspacePlanType.PERSONAL ? (
              <div>
                <dt className="text-[var(--color-muted)]">Org-only capabilities</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {lockedCapabilities.map((workspaceCapability) => (
                    <span
                      className="rounded-full border border-dashed border-[var(--color-line)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]"
                      key={workspaceCapability}
                    >
                      {formatWorkspaceCapabilityLabel(workspaceCapability)}
                    </span>
                  ))}
                </dd>
                <dd className="mt-3 text-xs text-[var(--color-muted)]">
                  These features require the {formatWorkspacePlanLabel(
                    getMinimumWorkspacePlanForCapability(lockedCapabilities[0]),
                  )} package.
                </dd>
              </div>
            ) : null}
            {workspaceState.membership.role === "OWNER" ? (
              <div className="pt-2">
                <dt className="text-[var(--color-muted)]">Plan controls</dt>
                <dd className="mt-3 flex flex-wrap gap-3">
                  <form action={updateWorkspacePlanAction}>
                    <input name="targetWorkspacePlanType" type="hidden" value={WorkspacePlanType.PERSONAL} />
                    <button
                      className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={workspaceState.workspace.planType === WorkspacePlanType.PERSONAL}
                      type="submit"
                    >
                      Switch to Personal
                    </button>
                  </form>
                  <form action={updateWorkspacePlanAction}>
                    <input name="targetWorkspacePlanType" type="hidden" value={WorkspacePlanType.ORG} />
                    <button
                      className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={workspaceState.workspace.planType === WorkspacePlanType.ORG}
                      type="submit"
                    >
                      Switch to Org
                    </button>
                  </form>
                </dd>
                <dd className="mt-3 text-xs text-[var(--color-muted)]">
                  These temporary controls change capability access only. Existing data stays in place.
                </dd>
              </div>
            ) : null}
            <div className="pt-2">
              <dt className="text-[var(--color-muted)]">Usage counters</dt>
              <dd className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
                <div className="flex items-center justify-between gap-3">
                  <span>Properties</span>
                  <span className="font-medium text-[var(--color-ink)]">
                    {workspacePlanUsageData.properties} / {formatUsageLimit(workspacePlanUsageLimits.properties)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Members</span>
                  <span className="font-medium text-[var(--color-ink)]">
                    {workspacePlanUsageData.memberships} / {formatUsageLimit(workspacePlanUsageLimits.memberships)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Templates</span>
                  <span className="font-medium text-[var(--color-ink)]">
                    {workspacePlanUsageData.messageTemplates} / {formatUsageLimit(workspacePlanUsageLimits.messageTemplates)}
                  </span>
                </div>
              </dd>
            </div>
            {workspaceBillingOwnerTransferData.candidates.length > 1 ? (
              <div className="pt-2">
                <dt className="text-[var(--color-muted)]">Billing owner transfer</dt>
                <dd className="mt-3 text-sm text-[var(--color-muted)]">
                  Transfer billing responsibility to another owner or admin without changing their workspace membership.
                </dd>
                <dd className="mt-3">
                  <form action={transferBillingOwnerAction} className="flex flex-wrap items-end gap-3">
                    <label className="space-y-2">
                      <span className="block text-sm font-medium text-[var(--color-ink)]">
                        New billing owner
                      </span>
                      <select
                        className="min-w-[16rem] rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none"
                        defaultValue={workspaceBillingOwnerTransferData.billingOwnerUserId ?? workspaceBillingOwnerTransferData.candidates[0]?.userId}
                        name="targetUserId"
                      >
                        {workspaceBillingOwnerTransferData.candidates.map((billingOwnerCandidate) => (
                          <option key={billingOwnerCandidate.userId} value={billingOwnerCandidate.userId}>
                            {billingOwnerCandidate.userName} ({billingOwnerCandidate.userEmailAddress}) - {billingOwnerCandidate.membershipRole}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)]"
                      type="submit"
                    >
                      Transfer billing owner
                    </button>
                  </form>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Integrations</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Email, SMS, webhook, and CSV import placeholders now live on a
            dedicated route.
          </p>
          <Link
            className="mt-5 inline-flex rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
            href="/app/settings/integrations"
          >
            Open integrations
          </Link>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Security</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Review active devices, revoke stale sessions, and close the current
            operator session from one place.
          </p>
          <Link
            className="mt-5 inline-flex rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
            href="/app/settings/security"
          >
            Open security
          </Link>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Members</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Invite teammates, review pending workspace access, and confirm who can work this queue.
          </p>
          <Link
            className="mt-5 inline-flex rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
            href={
              workspaceState.workspace.planType === WorkspacePlanType.PERSONAL
                ? "/app/settings?upgrade=org-members"
                : "/app/settings/members"
            }
          >
            {workspaceState.workspace.planType === WorkspacePlanType.PERSONAL
              ? "View Org upgrade details"
              : "Open members"}
          </Link>
        </div>
      </div>
    </main>
  );
}
