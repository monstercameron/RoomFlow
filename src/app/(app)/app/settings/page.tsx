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

const primaryActionClassName =
  "inline-flex items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.24)] bg-[var(--color-accent)] px-4 py-3 text-sm font-medium !text-white visited:!text-white hover:!text-white focus-visible:!text-white active:!text-white shadow-[0_10px_24px_rgba(141,63,33,0.22)] transition-colors duration-150 hover:bg-[var(--color-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] disabled:cursor-not-allowed disabled:border-[rgba(184,88,51,0.12)] disabled:bg-[rgba(184,88,51,0.18)] disabled:!text-white disabled:shadow-none";

const secondaryActionClassName =
  "inline-flex items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.96)] px-4 py-3 text-sm font-medium !text-[var(--color-ink)] visited:!text-[var(--color-ink)] hover:!text-[var(--color-ink)] focus-visible:!text-[var(--color-ink)] active:!text-[var(--color-ink)] shadow-[0_8px_18px_rgba(93,64,39,0.06)] transition-[border-color,background-color,color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.2)] hover:bg-[linear-gradient(180deg,rgba(255,247,239,1),rgba(244,233,221,1))] hover:shadow-[0_12px_24px_rgba(93,64,39,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] disabled:cursor-not-allowed disabled:border-[var(--color-line)] disabled:bg-[rgba(244,238,229,0.9)] disabled:!text-[var(--color-muted)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:border-[var(--color-line)] disabled:hover:bg-[rgba(244,238,229,0.9)]";

const secondaryEmphasisActionClassName =
  "inline-flex items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.24)] bg-[linear-gradient(180deg,rgba(255,244,236,0.98),rgba(246,231,217,0.98))] px-5 py-3 text-sm font-medium !text-[var(--color-accent-strong)] visited:!text-[var(--color-accent-strong)] hover:!text-[var(--color-accent-strong)] focus-visible:!text-[var(--color-accent-strong)] active:!text-[var(--color-accent-strong)] shadow-[0_10px_22px_rgba(141,63,33,0.08)] transition-[border-color,background-color,color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.32)] hover:bg-[linear-gradient(180deg,rgba(255,236,224,1),rgba(241,220,201,1))] hover:shadow-[0_12px_26px_rgba(141,63,33,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] disabled:cursor-not-allowed disabled:border-[rgba(184,88,51,0.12)] disabled:bg-[rgba(244,238,229,0.92)] disabled:!text-[var(--color-muted)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:border-[rgba(184,88,51,0.12)] disabled:hover:bg-[rgba(244,238,229,0.92)]";

const statCardClassName =
  "rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4 shadow-[0_10px_24px_rgba(93,64,39,0.05)]";

const insetPanelClassName =
  "rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5";

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

function getUsageSummaryTone(currentValue: number, limitValue: number | null) {
  if (limitValue === null) {
    return "text-[var(--color-ink)]";
  }

  const usageRatio = currentValue / limitValue;

  if (usageRatio >= 1) {
    return "text-[var(--color-accent-strong)]";
  }

  if (usageRatio >= 0.75) {
    return "text-[rgba(140,96,35,0.92)]";
  }

  return "text-[var(--color-ink)]";
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
  const canManagePlan =
    workspaceState.membership.role === "OWNER" ||
    workspaceState.workspace.billingOwner?.id === workspaceState.user.id;
  const currentBillingOwnerCandidate = workspaceBillingOwnerTransferData.candidates.find(
    (candidate) => candidate.userId === workspaceBillingOwnerTransferData.billingOwnerUserId,
  );

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Operator and workspace settings"
        description="Manage operator identity, workspace access, plan controls, and operational integrations from one place without hunting across separate admin screens."
      />

      {upgradePromptCopy ? (
        <div className="mb-4 rounded-[2rem] border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] p-6 shadow-[var(--shadow-panel)]">
          <h2 className="text-xl font-semibold text-[var(--color-accent-strong)]">
            {upgradePromptCopy.title}
          </h2>
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

      <section className="rounded-[2.25rem] border border-[var(--color-line)] bg-[linear-gradient(180deg,rgba(255,250,245,0.96),rgba(246,239,232,0.96))] p-6 shadow-[var(--shadow-panel)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
              Workspace snapshot
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
              Keep identity, plan, and access decisions in one operating surface.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
              The layout below prioritizes the actions operators actually need: confirm who is signed in, verify workspace limits, change plan ownership safely, and jump directly into the deeper settings areas.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgba(184,88,51,0.16)] bg-[rgba(184,88,51,0.08)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-strong)]">
                {formatWorkspacePlanLabel(workspaceState.workspace.planType)} package
              </span>
              <span className="rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.72)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
                {formatWorkspacePlanStatusLabel(workspaceState.workspace.planStatus)}
              </span>
              <span className="rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.72)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
                {workspaceState.membership.role} role
              </span>
              <span className="rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.72)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
                {workspaceState.onboardingComplete ? "Onboarding complete" : "Onboarding in progress"}
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:w-[24rem] xl:grid-cols-1">
            <Link className={primaryActionClassName} href="/app/settings/integrations">
              Open integrations hub
            </Link>
            <div className="flex flex-wrap gap-3">
              <Link className={secondaryEmphasisActionClassName} href="/app/settings/security">
                Security and sessions
              </Link>
              <Link
                className={secondaryEmphasisActionClassName}
                href={
                  workspaceState.workspace.planType === WorkspacePlanType.PERSONAL
                    ? "/app/settings?upgrade=org-members"
                    : "/app/settings/team"
                }
              >
                {workspaceState.workspace.planType === WorkspacePlanType.PERSONAL
                  ? "Team upgrade path"
                  : "Team access"}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className={statCardClassName}>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Operator</div>
            <div className="mt-3 text-lg font-semibold text-[var(--color-ink)]">{workspaceState.user.name}</div>
            <div className="mt-1 text-sm text-[var(--color-muted)]">{workspaceState.user.email}</div>
            <div className="mt-4 text-sm text-[var(--color-muted)]">
              Active role <span className="font-medium text-[var(--color-ink)]">{workspaceState.membership.role}</span>
            </div>
          </div>
          <div className={statCardClassName}>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Workspace</div>
            <div className="mt-3 text-lg font-semibold text-[var(--color-ink)]">{workspaceState.workspace.name}</div>
            <div className="mt-1 break-all text-sm text-[var(--color-muted)]">{workspaceState.workspace.slug}</div>
            <div className="mt-4 text-sm text-[var(--color-muted)]">
              Billing owner <span className="font-medium text-[var(--color-ink)]">{workspaceState.workspace.billingOwner?.email ?? "Unassigned"}</span>
            </div>
          </div>
          <div className={statCardClassName}>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Usage snapshot</div>
            <div className="mt-3 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Properties</span>
                <span className={`font-semibold ${getUsageSummaryTone(workspacePlanUsageData.properties, workspacePlanUsageLimits.properties)}`}>
                  {workspacePlanUsageData.properties} / {formatUsageLimit(workspacePlanUsageLimits.properties)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Members</span>
                <span className={`font-semibold ${getUsageSummaryTone(workspacePlanUsageData.memberships, workspacePlanUsageLimits.memberships)}`}>
                  {workspacePlanUsageData.memberships} / {formatUsageLimit(workspacePlanUsageLimits.memberships)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Templates</span>
                <span className={`font-semibold ${getUsageSummaryTone(workspacePlanUsageData.messageTemplates, workspacePlanUsageLimits.messageTemplates)}`}>
                  {workspacePlanUsageData.messageTemplates} / {formatUsageLimit(workspacePlanUsageLimits.messageTemplates)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">Plan and capability access</div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Package controls and enabled workspace capabilities</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                  Confirm what this workspace can use today, what remains locked on Personal, and who has authority to change billing ownership or package level.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-[rgba(184,88,51,0.16)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
                {canManagePlan
                  ? "You can manage package level and billing ownership for this workspace."
                  : "Only the workspace owner or current billing owner can change package level."}
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
              <div className={insetPanelClassName}>
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Current package</div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="text-xl font-semibold text-[var(--color-ink)]">
                    {formatWorkspacePlanLabel(workspaceState.workspace.planType)}
                  </div>
                  <span className="rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.72)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
                    {formatWorkspacePlanStatusLabel(workspaceState.workspace.planStatus)}
                  </span>
                </div>
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Enabled capabilities</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {workspaceState.workspace.enabledCapabilities.map((workspaceCapability) => (
                      <span
                        className="rounded-full border border-[rgba(184,88,51,0.14)] bg-[rgba(184,88,51,0.08)] px-3 py-1 text-xs font-medium text-[var(--color-accent-strong)]"
                        key={workspaceCapability}
                      >
                        {formatWorkspaceCapabilityLabel(workspaceCapability)}
                      </span>
                    ))}
                  </div>
                </div>
                {workspaceState.workspace.planType === WorkspacePlanType.PERSONAL ? (
                  <div className="mt-5 rounded-[1.5rem] border border-dashed border-[var(--color-line)] bg-[rgba(255,255,255,0.7)] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Locked on Personal</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {lockedCapabilities.map((workspaceCapability) => (
                        <span
                          className="rounded-full border border-dashed border-[var(--color-line)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]"
                          key={workspaceCapability}
                        >
                          {formatWorkspaceCapabilityLabel(workspaceCapability)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-[var(--color-muted)]">
                      These features require the {formatWorkspacePlanLabel(
                        getMinimumWorkspacePlanForCapability(lockedCapabilities[0]),
                      )} package.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className={insetPanelClassName}>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Package controls</div>
                  <div className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                    These controls change capability access only. Existing records remain intact when the package changes.
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={updateWorkspacePlanAction}>
                      <input name="targetWorkspacePlanType" type="hidden" value={WorkspacePlanType.PERSONAL} />
                      <button
                        className={secondaryActionClassName}
                        disabled={!canManagePlan || workspaceState.workspace.planType === WorkspacePlanType.PERSONAL}
                        type="submit"
                      >
                        Switch to Personal
                      </button>
                    </form>
                    <form action={updateWorkspacePlanAction}>
                      <input name="targetWorkspacePlanType" type="hidden" value={WorkspacePlanType.ORG} />
                      <button
                        className={primaryActionClassName}
                        disabled={!canManagePlan || workspaceState.workspace.planType === WorkspacePlanType.ORG}
                        type="submit"
                      >
                        Switch to Org
                      </button>
                    </form>
                  </div>
                </div>

                <div className={insetPanelClassName}>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Billing owner</div>
                  <div className="mt-3 text-lg font-semibold text-[var(--color-ink)]">
                    {currentBillingOwnerCandidate?.userName ?? workspaceState.workspace.billingOwner?.email ?? "Unassigned"}
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {workspaceState.workspace.billingOwner?.email ?? "No billing owner assigned yet."}
                  </div>

                  {workspaceBillingOwnerTransferData.candidates.length > 1 ? (
                    <form action={transferBillingOwnerAction} className="mt-4 space-y-3">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">Transfer to another owner or admin</span>
                        <select
                          className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]"
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
                      <p className="text-sm leading-7 text-[var(--color-muted)]">
                        Choose a different eligible teammate to move billing responsibility without changing their workspace membership.
                      </p>
                      <button className={secondaryActionClassName} disabled={!canManagePlan} type="submit">
                        Transfer billing owner
                      </button>
                    </form>
                  ) : (
                    <p className="mt-4 text-sm leading-7 text-[var(--color-muted)]">
                      Add another owner or admin before transferring billing responsibility.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] md:p-7">
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">Workspace details</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Identity and routing details</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className={insetPanelClassName}>
                <h3 className="text-lg font-semibold text-[var(--color-ink)]">Profile</h3>
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Name</dt>
                    <dd className="mt-1 font-medium text-[var(--color-ink)]">{workspaceState.user.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Email</dt>
                    <dd className="mt-1 font-medium text-[var(--color-ink)]">{workspaceState.user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Membership role</dt>
                    <dd className="mt-1 font-medium text-[var(--color-ink)]">{workspaceState.membership.role}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm leading-7 text-[var(--color-muted)]">
                  Manage operator name and email from the dedicated profile workspace. Password and linked sign-in methods still live under Security settings.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link className={secondaryActionClassName} href="/app/settings/profile">
                    Manage profile
                  </Link>
                  <Link className={secondaryActionClassName} href="/app/settings/security">
                    Password and security
                  </Link>
                </div>
              </div>
              <div className={insetPanelClassName}>
                <h3 className="text-lg font-semibold text-[var(--color-ink)]">Workspace</h3>
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Workspace name</dt>
                    <dd className="mt-1 font-medium text-[var(--color-ink)]">{workspaceState.workspace.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Slug</dt>
                    <dd className="mt-1 break-all font-medium text-[var(--color-ink)]">{workspaceState.workspace.slug}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Onboarding state</dt>
                    <dd className="mt-1 font-medium text-[var(--color-ink)]">
                      {workspaceState.onboardingComplete ? "Complete" : "In progress"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
