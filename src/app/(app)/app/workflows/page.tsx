import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  createPropertyWorkflowOverrideAction,
  createStarterWorkflowAction,
  createWorkflowAction,
  updateWorkflowStatusAction,
} from "@/lib/workflow-actions";
import { getWorkflowsViewData } from "@/lib/workflow-data";
import { WorkflowScope, WorkflowSharingVisibility, WorkflowStatus } from "@/generated/prisma/client";

export default async function WorkflowsPage() {
  const workflowData = await getWorkflowsViewData();

  return (
    <main>
      <PageHeader
        eyebrow="Workflows"
        title="Automation builder"
        description="Manage reusable automation templates, property overrides, workflow status, and the shared automation library from one place."
      />

      {!workflowData.hasAdvancedAutomations ? (
        <section className="rounded-[2rem] border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] p-6 text-sm text-[var(--color-accent-strong)] shadow-[var(--shadow-panel)]">
          Advanced automations are not enabled for this workspace yet. Upgrade to an Org workspace to use the workflow builder.
        </section>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
              <div className="text-sm text-[var(--color-muted)]">Total workflows</div>
              <div className="mt-2 text-3xl font-semibold">{workflowData.workflowCounts.total}</div>
            </div>
            <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
              <div className="text-sm text-[var(--color-muted)]">Active automations</div>
              <div className="mt-2 text-3xl font-semibold">{workflowData.workflowCounts.active}</div>
            </div>
            <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
              <div className="text-sm text-[var(--color-muted)]">Property overrides</div>
              <div className="mt-2 text-3xl font-semibold">{workflowData.workflowCounts.propertyOverrides}</div>
            </div>
            <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
              <div className="text-sm text-[var(--color-muted)]">Org shared library</div>
              <div className="mt-2 text-3xl font-semibold">{workflowData.workflowCounts.sharedLibrary}</div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <section className="space-y-6">
              <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
                <div className="text-lg font-semibold">Create workflow</div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Start with a blank automation and add triggers, conditions, and actions in the builder.
                </p>
                <form action={createWorkflowAction} className="mt-4 space-y-3">
                  <input type="hidden" name="redirectTo" value="/app/workflows" />
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="name"
                    placeholder="New workflow name"
                    required
                    type="text"
                  />
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="description"
                    placeholder="What should this workflow automate?"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Scope</span>
                      <select
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={WorkflowScope.WORKSPACE}
                        name="scope"
                      >
                        <option value={WorkflowScope.WORKSPACE}>Workspace</option>
                        <option value={WorkflowScope.PROPERTY}>Property override</option>
                        {workflowData.canUseOrgLibrary ? (
                          <option value={WorkflowScope.ORG_LIBRARY}>Org library</option>
                        ) : null}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Sharing</span>
                      <select
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={WorkflowSharingVisibility.WORKSPACE}
                        name="sharingVisibility"
                      >
                        <option value={WorkflowSharingVisibility.PRIVATE}>Private</option>
                        <option value={WorkflowSharingVisibility.WORKSPACE}>Workspace shared</option>
                        {workflowData.canUseOrgLibrary ? (
                          <option value={WorkflowSharingVisibility.ORG_LIBRARY}>Org shared</option>
                        ) : null}
                      </select>
                    </label>
                  </div>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Property</span>
                    <select
                      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue=""
                      name="propertyId"
                    >
                      <option value="">No property override</option>
                      {workflowData.properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                    type="submit"
                  >
                    Create workflow
                  </button>
                </form>
              </div>

              <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
                <div className="text-lg font-semibold">Starter templates</div>
                <div className="mt-4 space-y-4">
                  {workflowData.starterTemplates.map((starterTemplate) => (
                    <form
                      key={starterTemplate.key}
                      action={createStarterWorkflowAction}
                      className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                    >
                      <div className="text-base font-medium">{starterTemplate.name}</div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">{starterTemplate.description}</div>
                      <input type="hidden" name="redirectTo" value="/app/workflows" />
                      <input type="hidden" name="templateKey" value={starterTemplate.key} />
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <select
                          className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                          defaultValue={starterTemplate.recommendedScope}
                          name="scope"
                        >
                          <option value={WorkflowScope.WORKSPACE}>Workspace</option>
                          <option value={WorkflowScope.PROPERTY}>Property override</option>
                          {workflowData.canUseOrgLibrary ? (
                            <option value={WorkflowScope.ORG_LIBRARY}>Org library</option>
                          ) : null}
                        </select>
                        <select
                          className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                          defaultValue={starterTemplate.sharingVisibility}
                          name="sharingVisibility"
                        >
                          <option value={WorkflowSharingVisibility.PRIVATE}>Private</option>
                          <option value={WorkflowSharingVisibility.WORKSPACE}>Workspace shared</option>
                          {workflowData.canUseOrgLibrary ? (
                            <option value={WorkflowSharingVisibility.ORG_LIBRARY}>Org shared</option>
                          ) : null}
                        </select>
                      </div>
                      <select
                        className="mt-3 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue=""
                        name="propertyId"
                      >
                        <option value="">No property override</option>
                        {workflowData.properties.map((property) => (
                          <option key={property.id} value={property.id}>
                            {property.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="mt-3 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium"
                        type="submit"
                      >
                        Create from template
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              {workflowData.workflows.length === 0 ? (
                <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)] shadow-[var(--shadow-panel)]">
                  No workflows exist yet. Create a blank workflow or start from one of the starter templates.
                </div>
              ) : (
                workflowData.workflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xl font-semibold">{workflow.name}</div>
                        <div className="mt-2 text-sm text-[var(--color-muted)]">{workflow.description}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                          <span className="rounded-full border border-[var(--color-line)] px-3 py-1">{workflow.scope}</span>
                          <span className="rounded-full border border-[var(--color-line)] px-3 py-1">{workflow.status}</span>
                          <span className="rounded-full border border-[var(--color-line)] px-3 py-1">{workflow.sharingVisibility}</span>
                          {workflow.propertyName ? (
                            <span className="rounded-full border border-[var(--color-line)] px-3 py-1">{workflow.propertyName}</span>
                          ) : null}
                          {workflow.baseWorkflowName ? (
                            <span className="rounded-full border border-[var(--color-line)] px-3 py-1">Override of {workflow.baseWorkflowName}</span>
                          ) : null}
                        </div>
                      </div>
                      <Link
                        className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                        href={`/app/workflows/${workflow.id}`}
                      >
                        Open builder
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                        <div className="text-sm text-[var(--color-muted)]">Versions</div>
                        <div className="mt-1 font-medium">{workflow.versionCount}</div>
                        <div className="mt-2 text-xs text-[var(--color-muted)]">
                          Published: {workflow.publishedVersionNumber ?? "None"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                        <div className="text-sm text-[var(--color-muted)]">Latest version</div>
                        <div className="mt-1 font-medium">
                          {workflow.latestVersion
                            ? `v${workflow.latestVersion.versionNumber} • ${workflow.latestVersion.versionStatus}`
                            : "No version"}
                        </div>
                        <div className="mt-2 text-xs text-[var(--color-muted)]">
                          {workflow.latestVersion
                            ? `${workflow.latestVersion.nodeCount} nodes • ${workflow.latestVersion.edgeCount} edges`
                            : "Add a version to start building."}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                        <div className="text-sm text-[var(--color-muted)]">Approvals</div>
                        <div className="mt-1 font-medium">
                          {workflow.latestVersion?.approvalNodeCount ?? 0} approval step(s)
                        </div>
                        <div className="mt-2 text-xs text-[var(--color-muted)]">
                          Sensitive declines and screening actions stay human-approved.
                        </div>
                      </div>
                    </div>

                    {workflow.latestVersion ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                          <div className="text-sm font-medium">Triggers</div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                            {workflow.latestVersion.triggerLabels.map((triggerLabel) => (
                              <span key={triggerLabel} className="rounded-full border border-[var(--color-line)] px-3 py-1">
                                {triggerLabel}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                          <div className="text-sm font-medium">Actions</div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                            {workflow.latestVersion.actionLabels.map((actionLabel) => (
                              <span key={actionLabel} className="rounded-full border border-[var(--color-line)] px-3 py-1">
                                {actionLabel}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 md:grid-cols-[auto_auto_1fr]">
                      {[WorkflowStatus.ACTIVE, WorkflowStatus.PAUSED, WorkflowStatus.ARCHIVED].map((workflowStatus) => (
                        <form key={workflowStatus} action={updateWorkflowStatusAction.bind(null, workflow.id)}>
                          <input type="hidden" name="redirectTo" value="/app/workflows" />
                          <input type="hidden" name="status" value={workflowStatus} />
                          <button
                            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                            disabled={workflow.statusValue === workflowStatus}
                            type="submit"
                          >
                            Set {workflowStatus.toLowerCase()}
                          </button>
                        </form>
                      ))}
                    </div>

                    {workflow.scopeValue !== WorkflowScope.PROPERTY && workflowData.properties.length > 0 ? (
                      <form
                        action={createPropertyWorkflowOverrideAction.bind(null, workflow.id)}
                        className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                      >
                        <div className="text-sm font-medium">Create property override</div>
                        <div className="mt-2 text-sm text-[var(--color-muted)]">
                          Use the latest version as the base for a property-specific override.
                        </div>
                        <input type="hidden" name="redirectTo" value="/app/workflows" />
                        <div className="mt-3 flex flex-wrap gap-3">
                          <select
                            className="min-w-56 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                            defaultValue=""
                            name="propertyId"
                            required
                          >
                            <option disabled value="">
                              Choose property
                            </option>
                            {workflowData.properties.map((property) => (
                              <option key={property.id} value={property.id}>
                                {property.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium"
                            type="submit"
                          >
                            Create override
                          </button>
                        </div>
                        {workflow.overrideSummaries.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                            {workflow.overrideSummaries.map((override) => (
                              <span key={override.id} className="rounded-full border border-[var(--color-line)] px-3 py-1">
                                {override.propertyName}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
