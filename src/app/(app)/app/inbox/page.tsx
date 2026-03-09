import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  generateLeadInsightsAction,
  generateLeadTranslationAction,
} from "@/lib/ai-actions";
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
  sendManualOutboundMessageAction,
  sendApplicationAction,
} from "@/lib/lead-actions";
import { assignLeadOwnerAction } from "@/lib/collaboration-actions";

type InboxPageProps = {
  searchParams: Promise<{
    workflowError?: string;
    queue?: string;
  }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const resolvedSearchParams = await searchParams;
  const queueFilter = resolvedSearchParams.queue ?? "all";
  const currentInboxHref = `/app/inbox?queue=${queueFilter}`;
  const inbox = await getInboxViewData(queueFilter);
  const threads = inbox.threads;
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
          { key: "mine", label: "My queue" },
          { key: "unassigned", label: "Unassigned" },
          { key: "review", label: "Review queue" },
          { key: "overdue", label: "Overdue" },
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
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                  <span className="rounded-full border border-[var(--color-line)] px-2 py-1">
                    Owner: {thread.assignedTo}
                  </span>
                  {thread.slaSummary ? (
                    <span className={`rounded-full border px-2 py-1 ${thread.slaSummary.isOverdue ? "border-[rgba(184,88,51,0.28)] text-[var(--color-accent-strong)]" : "border-[var(--color-line)]"}`}>
                      {thread.slaSummary.label} · {thread.slaSummary.dueAt}
                    </span>
                  ) : null}
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
                  {thread.latestMessageDeliveryStatus ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                      <span className="rounded-full border border-[var(--color-line)] px-3 py-1">
                        {thread.latestMessageDeliveryStatus.label}
                      </span>
                      {thread.latestMessageDeliveryStatus.detail ? (
                        <span>{thread.latestMessageDeliveryStatus.detail}</span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-2 text-sm leading-7">{thread.latestMessage}</div>
                  {thread.latestMessageDeliveryStatus?.error ? (
                    <div className="mt-3 text-xs text-[var(--color-accent-strong)]">
                      Delivery issue: {thread.latestMessageDeliveryStatus.error}
                    </div>
                  ) : null}
                  {thread.latestMessageMentions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                      {thread.latestMessageMentions.map((mention) => (
                        <span
                          key={`${thread.id}-${mention.userId}`}
                          className="rounded-full border border-[var(--color-line)] px-3 py-1"
                        >
                          @{mention.canonicalHandle} | {mention.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {inbox.hasAiAssist ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-medium">AI summary</div>
                        <form action={generateLeadInsightsAction.bind(null, thread.id)}>
                          <input type="hidden" name="redirectTo" value={currentInboxHref} />
                          <button
                            className="rounded-2xl border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium"
                            type="submit"
                          >
                            Refresh AI
                          </button>
                        </form>
                      </div>
                      {thread.leadInsightsArtifact?.status === "failed" ? (
                        <div className="mt-3 text-sm text-[var(--color-accent-strong)]">
                          {thread.leadInsightsArtifact.error}
                        </div>
                      ) : null}
                      {thread.leadInsightsArtifact?.status === "ready" ? (
                        <>
                          <div className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                            {thread.leadInsightsArtifact.data.summary}
                          </div>
                          <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-white px-3 py-3 text-sm">
                            <div className="font-medium">
                              {thread.leadInsightsArtifact.data.nextBestAction.label}
                            </div>
                            <div className="mt-1 text-[var(--color-muted)]">
                              {thread.leadInsightsArtifact.data.nextBestAction.rationale}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                      <div className="text-sm font-medium">Translation</div>
                      <form
                        action={generateLeadTranslationAction.bind(null, thread.id)}
                        className="mt-3 flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="redirectTo" value={currentInboxHref} />
                        <input type="hidden" name="sourceSummary" value={thread.translationSourceSummary} />
                        <input type="hidden" name="sourceText" value={thread.latestMessage} />
                        <label className="space-y-2">
                          <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                            Language
                          </span>
                          <input
                            className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                            defaultValue="Spanish"
                            name="targetLanguage"
                            type="text"
                          />
                        </label>
                        <button
                          className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium"
                          type="submit"
                        >
                          Translate
                        </button>
                      </form>
                      {thread.translationArtifact?.status === "failed" ? (
                        <div className="mt-3 text-sm text-[var(--color-accent-strong)]">
                          {thread.translationArtifact.error}
                        </div>
                      ) : null}
                      {thread.translationArtifact?.status === "ready" ? (
                        <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-white px-3 py-3 text-sm leading-7 text-[var(--color-muted)]">
                          {thread.translationArtifact.data.translatedText}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {thread.automationSuppressionSummaries.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                    <div className="text-sm font-medium">Automation suppression reasons</div>
                    <div className="mt-3 space-y-3 text-sm text-[var(--color-muted)]">
                      {thread.automationSuppressionSummaries.map((summary) => (
                        <div key={`${thread.id}-${summary.actionKey}`}>
                          <div className="font-medium text-[var(--color-ink)]">
                            {summary.actionLabel}
                          </div>
                          <div className="mt-2 space-y-2">
                            {summary.reasons.map((reason) => (
                              <div
                                key={`${thread.id}-${summary.actionKey}-${reason}`}
                              >
                                {reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <form
                  action={sendManualOutboundMessageAction.bind(null, thread.id)}
                  className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                >
                  <div className="text-sm font-medium">Internal note</div>
                  {thread.availableInternalNoteMentions.length > 0 ? (
                    <p className="mt-2 text-xs text-[var(--color-muted)]">
                      Mention teammates with {thread.availableInternalNoteMentions.map((mention) => `@${mention.canonicalHandle}`).join(", ")}.
                    </p>
                  ) : null}
                  <input type="hidden" name="manualChannel" value="INTERNAL_NOTE" />
                  <input type="hidden" name="redirectTo" value={currentInboxHref} />
                  <textarea
                    className="mt-3 min-h-24 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="manualBody"
                    placeholder="Add private context to this lead thread. Use @teammate to tag someone."
                    required
                  />
                  <button
                    className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Save note
                  </button>
                </form>
              </div>

              <div className="flex min-w-72 flex-col gap-3">
                <form action={evaluateLeadAction.bind(null, thread.id)}>
                  <input type="hidden" name="redirectTo" value={currentInboxHref} />
                  <button
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Re-evaluate fit
                  </button>
                </form>
                <form action={requestInfoAction.bind(null, thread.id)}>
                  <input type="hidden" name="redirectTo" value={currentInboxHref} />
                  <button
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!thread.canRequestInfo}
                    type="submit"
                  >
                    Request missing info
                  </button>
                </form>
                <form action={scheduleTourAction.bind(null, thread.id)}>
                  <input type="hidden" name="redirectTo" value={currentInboxHref} />
                  <button
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!thread.canScheduleTour}
                    type="submit"
                  >
                    Schedule tour
                  </button>
                </form>
                <form action={sendApplicationAction.bind(null, thread.id)}>
                  <input type="hidden" name="redirectTo" value={currentInboxHref} />
                  <button
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!thread.canSendApplication}
                    type="submit"
                  >
                    Send application
                  </button>
                </form>
                <form action={declineLeadAction.bind(null, thread.id)}>
                  <input type="hidden" name="declineReason" value="OPERATOR_DECISION" />
                  <input type="hidden" name="declineNote" value="Declined from inbox triage." />
                  <input type="hidden" name="redirectTo" value={currentInboxHref} />
                  <button
                    className="w-full rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Decline
                  </button>
                </form>

                <form
                  action={assignLeadOwnerAction.bind(null, thread.id)}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                >
                  <div className="text-sm font-medium">Lead owner</div>
                  <select
                    className="mt-3 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={thread.assignedMembershipId ?? "unassigned"}
                    disabled={!thread.canAssignOwner}
                    name="assignedMembershipId"
                  >
                    {thread.assignmentOptions.map((assignmentOption) => (
                      <option key={`${thread.id}-${assignmentOption.value}`} value={assignmentOption.value}>
                        {assignmentOption.label} | {assignmentOption.summary}
                      </option>
                    ))}
                  </select>
                    <input type="hidden" name="redirectTo" value={currentInboxHref} />
                  <button
                    className="mt-3 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!thread.canAssignOwner}
                    type="submit"
                  >
                    Save owner
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
                    <input type="hidden" name="redirectTo" value={currentInboxHref} />
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
