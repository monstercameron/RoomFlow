import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { WorkflowBuilderCanvas } from "@/components/workflow-builder-canvas";
import {
  addWorkflowEdgeAction,
  addWorkflowNodeAction,
  createWorkflowVersionAction,
  publishWorkflowVersionAction,
  updateWorkflowSharingAction,
  updateWorkflowStatusAction,
} from "@/lib/workflow-actions";
import { getWorkflowBuilderViewData } from "@/lib/workflow-data";
import {
  WorkflowNodeType,
  WorkflowSharingVisibility,
  WorkflowStatus,
  WorkflowVersionStatus,
} from "@/generated/prisma/client";

type WorkflowBuilderPageProps = {
  params: Promise<{ workflowId: string }>;
  searchParams?: Promise<{ versionId?: string }>;
};

export default async function WorkflowBuilderPage({ params, searchParams }: WorkflowBuilderPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const workflowData = await getWorkflowBuilderViewData(
    resolvedParams.workflowId,
    resolvedSearchParams?.versionId,
  );

  if (!workflowData) {
    notFound();
  }

  const selectedVersion = workflowData.workflow.versions.find(
    (version) => version.id === workflowData.builder?.selectedVersionId,
  );

  if (!workflowData.builder || !selectedVersion) {
    notFound();
  }

  return (
    <main>
      <PageHeader
        eyebrow="Workflow builder"
        title={workflowData.workflow.name}
        description={workflowData.workflow.description || "Build automation flows with reusable triggers, approval gates, and action nodes."}
        actions={
          <div className="flex flex-wrap gap-3">
            {[WorkflowStatus.ACTIVE, WorkflowStatus.PAUSED, WorkflowStatus.ARCHIVED].map((workflowStatus) => (
              <form key={workflowStatus} action={updateWorkflowStatusAction.bind(null, workflowData.workflow.id)}>
                <input type="hidden" name="redirectTo" value={`/app/workflows/${workflowData.workflow.id}`} />
                <input type="hidden" name="status" value={workflowStatus} />
                <button
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium"
                  disabled={workflowData.workflow.statusValue === workflowStatus}
                  type="submit"
                >
                  Set {workflowStatus.toLowerCase()}
                </button>
              </form>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm text-[var(--color-muted)]">Status</div>
          <div className="mt-2 text-xl font-semibold">{workflowData.workflow.status}</div>
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm text-[var(--color-muted)]">Scope</div>
          <div className="mt-2 text-xl font-semibold">{workflowData.workflow.scope}</div>
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm text-[var(--color-muted)]">Sharing</div>
          <div className="mt-2 text-xl font-semibold">{workflowData.workflow.sharingVisibility}</div>
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm text-[var(--color-muted)]">Published version</div>
          <div className="mt-2 text-xl font-semibold">{workflowData.workflow.publishedVersionNumber ?? "None"}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Versions</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Draft safely, then publish the version that should power live automations.
                </div>
              </div>
              <form action={createWorkflowVersionAction.bind(null, workflowData.workflow.id)}>
                <input type="hidden" name="redirectTo" value={`/app/workflows/${workflowData.workflow.id}`} />
                <input type="hidden" name="sourceVersionId" value={selectedVersion.id} />
                <button
                  className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Create new version
                </button>
              </form>
            </div>

            <div className="mt-4 space-y-3">
              {workflowData.workflow.versions.map((version) => (
                <div
                  key={version.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    version.id === selectedVersion.id
                      ? "border-[var(--color-accent)] bg-[rgba(184,88,51,0.08)]"
                      : "border-[var(--color-line)] bg-[var(--color-panel-strong)]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-medium">Version {version.versionNumber}</div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">{version.status}</div>
                      <div className="mt-2 text-xs text-[var(--color-muted)]">
                        {version.nodeCount} nodes • {version.edgeCount} edges • {version.approvalNodeCount} approval step(s)
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium"
                        href={`/app/workflows/${workflowData.workflow.id}?versionId=${version.id}`}
                      >
                        View
                      </Link>
                      {version.statusValue !== WorkflowVersionStatus.PUBLISHED ? (
                        <form action={publishWorkflowVersionAction.bind(null, workflowData.workflow.id)}>
                          <input type="hidden" name="redirectTo" value={`/app/workflows/${workflowData.workflow.id}?versionId=${version.id}`} />
                          <input type="hidden" name="versionId" value={version.id} />
                          <button
                            className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium"
                            type="submit"
                          >
                            Publish
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <WorkflowBuilderCanvas
            edges={workflowData.builder.edges}
            nodes={workflowData.builder.nodes}
          />
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-lg font-semibold">Sharing</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Control whether this workflow stays private, is shared across the workspace, or joins the org library.
            </div>
            <form action={updateWorkflowSharingAction.bind(null, workflowData.workflow.id)} className="mt-4 space-y-3">
              <input type="hidden" name="redirectTo" value={`/app/workflows/${workflowData.workflow.id}`} />
              <select
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={workflowData.workflow.sharingVisibilityValue}
                name="sharingVisibility"
              >
                <option value={WorkflowSharingVisibility.PRIVATE}>Private</option>
                <option value={WorkflowSharingVisibility.WORKSPACE}>Workspace shared</option>
                {workflowData.canUseOrgLibrary ? (
                  <option value={WorkflowSharingVisibility.ORG_LIBRARY}>Org shared</option>
                ) : null}
              </select>
              <button
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                type="submit"
              >
                Update sharing
              </button>
            </form>
          </div>

          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-lg font-semibold">Add node</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Add trigger, condition, or action nodes to the selected version. Sensitive actions automatically require approval.
            </div>
            <form action={addWorkflowNodeAction.bind(null, workflowData.workflow.id)} className="mt-4 space-y-3">
              <input type="hidden" name="redirectTo" value={`/app/workflows/${workflowData.workflow.id}?versionId=${selectedVersion.id}`} />
              <input type="hidden" name="workflowVersionId" value={selectedVersion.id} />
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Node name</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  name="name"
                  placeholder="Follow up by SMS"
                  required
                  type="text"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Node type</span>
                <select
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={WorkflowNodeType.ACTION}
                  name="nodeType"
                >
                  <option value={WorkflowNodeType.TRIGGER}>Trigger</option>
                  <option value={WorkflowNodeType.CONDITION}>Condition</option>
                  <option value={WorkflowNodeType.ACTION}>Action</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Trigger type</span>
                <select
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={workflowData.catalogs.triggers[0]?.value}
                  name="triggerType"
                >
                  {workflowData.catalogs.triggers.map((trigger) => (
                    <option key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Condition type</span>
                <select
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={workflowData.catalogs.conditions[0]?.value}
                  name="conditionType"
                >
                  {workflowData.catalogs.conditions.map((condition) => (
                    <option key={condition.value} value={condition.value}>
                      {condition.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Action type</span>
                <select
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={workflowData.catalogs.actions[0]?.value}
                  name="actionType"
                >
                  {workflowData.catalogs.actions.map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Config JSON</span>
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 font-mono text-sm outline-none"
                  defaultValue={JSON.stringify({}, null, 2)}
                  name="configJson"
                />
              </label>
              <button
                className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                type="submit"
              >
                Add node
              </button>
            </form>
          </div>

          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-lg font-semibold">Connect nodes</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Define the flow between nodes, including branch labels for approvals and conditional paths.
            </div>
            <form action={addWorkflowEdgeAction.bind(null, workflowData.workflow.id)} className="mt-4 space-y-3">
              <input type="hidden" name="redirectTo" value={`/app/workflows/${workflowData.workflow.id}?versionId=${selectedVersion.id}`} />
              <input type="hidden" name="workflowVersionId" value={selectedVersion.id} />
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">From node</span>
                <select className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" name="sourceNodeId">
                  {workflowData.builder.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">To node</span>
                <select className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" name="targetNodeId">
                  {workflowData.builder.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Branch label</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  name="label"
                  placeholder="approved"
                  type="text"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Branch key</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  name="branchKey"
                  placeholder="approved"
                  type="text"
                />
              </label>
              <button
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                type="submit"
              >
                Add connection
              </button>
            </form>
          </div>

          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-lg font-semibold">Catalog reference</div>
            <div className="mt-4 space-y-4 text-sm text-[var(--color-muted)]">
              <div>
                <div className="font-medium text-[var(--color-ink)]">Triggers</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workflowData.catalogs.triggers.map((trigger) => (
                    <span key={trigger.value} className="rounded-full border border-[var(--color-line)] px-3 py-1">
                      {trigger.label}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium text-[var(--color-ink)]">Conditions</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workflowData.catalogs.conditions.map((condition) => (
                    <span key={condition.value} className="rounded-full border border-[var(--color-line)] px-3 py-1">
                      {condition.label}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium text-[var(--color-ink)]">Actions</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workflowData.catalogs.actions.map((action) => (
                    <span key={action.value} className="rounded-full border border-[var(--color-line)] px-3 py-1">
                      {action.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
