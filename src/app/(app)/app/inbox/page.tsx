import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getInboxViewData } from "@/lib/app-data";
import {
  getLeadWorkflowErrorUserMessage,
  parseLeadWorkflowErrorCode,
} from "@/lib/lead-workflow-errors";
import {
  assignLeadPropertyAction,
  declineLeadAction,
  evaluateLeadAction,
  requestInfoAction,
  scheduleTourAction,
  sendApplicationAction,
} from "@/lib/lead-actions";

type InboxPageProps = {
  searchParams: Promise<{
    workflowError?: string;
    queue?: string;
  }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const resolvedSearchParams = await searchParams;
  const queueFilter = resolvedSearchParams.queue ?? "all";
  const threads = await getInboxViewData(queueFilter);
  const workflowErrorCode = parseLeadWorkflowErrorCode(
    resolvedSearchParams.workflowError,
  );
  const workflowErrorMessage = workflowErrorCode
    ? getLeadWorkflowErrorUserMessage(workflowErrorCode)
    : null;

  return (
    <main>
      <PageHeader
        eyebrow="Inbox"
        title="Conversation triage"
        description="A unified message view for the current workspace. This is the first pass: enough to review the latest thread, request missing information, and assign unassigned leads."
      />
      {workflowErrorMessage ? (
        <div className="mb-5 rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.12)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          {workflowErrorMessage}
        </div>
      ) : null}
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {[
          { key: "all", label: "All threads" },
          { key: "review", label: "Review queue" },
          { key: "duplicate", label: "Duplicate" },
          { key: "caution", label: "Caution" },
          { key: "mismatch", label: "Mismatch" },
          { key: "conflict", label: "Conflict" },
        ].map((queueOption) => (
          <Link
            key={queueOption.key}
            href={`/app/inbox?queue=${queueOption.key}`}
            className={`rounded-full border px-3 py-1 ${
              queueFilter === queueOption.key
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-[var(--color-line)] bg-[var(--color-panel)]"
            }`}
          >
            {queueOption.label}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    className="text-xl font-semibold underline decoration-[var(--color-line)] underline-offset-4"
                    href={`/app/leads/${thread.id}`}
                  >
                    {thread.name}
                  </Link>
                  <div className="rounded-full bg-[var(--color-sidebar)] px-3 py-1 text-xs text-white">
                    {thread.status}
                  </div>
                  <div className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs">
                    {thread.fit}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  {thread.source} | {thread.property} | {thread.lastActivity}
                </div>
                {thread.isReviewQueueItem ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                    {thread.reviewFlags.duplicate ? (
                      <span className="rounded-full border border-[var(--color-line)] px-2 py-1">
                        duplicate
                      </span>
                    ) : null}
                    {thread.reviewFlags.caution ? (
                      <span className="rounded-full border border-[var(--color-line)] px-2 py-1">
                        caution
                      </span>
                    ) : null}
                    {thread.reviewFlags.mismatch ? (
                      <span className="rounded-full border border-[var(--color-line)] px-2 py-1">
                        mismatch
                      </span>
                    ) : null}
                    {thread.reviewFlags.conflict ? (
                      <span className="rounded-full border border-[var(--color-line)] px-2 py-1">
                        conflict
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                    {thread.latestMessageDirection}
                  </div>
                  <div className="mt-2 text-sm leading-7">{thread.latestMessage}</div>
                </div>
              </div>

              <div className="flex min-w-72 flex-col gap-3">
                <form action={evaluateLeadAction.bind(null, thread.id)}>
                  <input type="hidden" name="redirectTo" value={`/app/inbox?queue=${queueFilter}`} />
                  <button
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Re-evaluate fit
                  </button>
                </form>
                <form action={requestInfoAction.bind(null, thread.id)}>
                  <button
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!thread.canRequestInfo}
                    type="submit"
                  >
                    Request missing info
                  </button>
                </form>
                <form action={scheduleTourAction.bind(null, thread.id)}>
                  <button
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Schedule tour
                  </button>
                </form>
                <form action={sendApplicationAction.bind(null, thread.id)}>
                  <button
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Send application
                  </button>
                </form>
                <form action={declineLeadAction.bind(null, thread.id)}>
                  <input type="hidden" name="declineReason" value="OPERATOR_DECISION" />
                  <input type="hidden" name="declineNote" value="Declined from review queue." />
                  <input type="hidden" name="redirectTo" value="/app/inbox?queue=review" />
                  <button
                    className="w-full rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Decline
                  </button>
                </form>

                {thread.needsAssignment ? (
                  <form
                    action={assignLeadPropertyAction.bind(null, thread.id)}
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                  >
                    <div className="text-sm font-medium">Assign property</div>
                    <select
                      className="mt-3 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue=""
                      name="propertyId"
                      required
                    >
                      <option disabled value="">
                        Choose property
                      </option>
                      {thread.availableProperties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                    <input type="hidden" name="redirectTo" value="/app/inbox" />
                    <button
                      className="mt-3 w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                      type="submit"
                    >
                      Save assignment
                    </button>
                  </form>
                ) : (
                  <Link
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-center text-sm font-medium"
                    href={`/app/leads/${thread.id}`}
                  >
                    Open lead detail
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
