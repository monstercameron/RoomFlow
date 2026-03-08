import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getLeadDetailViewData } from "@/lib/app-data";
import {
  getLeadWorkflowErrorUserMessage,
  parseLeadWorkflowErrorCode,
} from "@/lib/lead-workflow-errors";
import {
  evaluateLeadAction,
  requestInfoAction,
  scheduleTourAction,
  sendApplicationAction,
  assignLeadPropertyAction,
  confirmDuplicateLeadAction,
  declineLeadAction,
  overrideLeadRoutingAction,
  sendManualOutboundMessageAction,
} from "@/lib/lead-actions";

type LeadDetailPageProps = {
  params: Promise<{
    leadId: string;
  }>;
  searchParams: Promise<{
    workflowError?: string;
  }>;
};

export default async function LeadDetailPage({
  params,
  searchParams,
}: LeadDetailPageProps) {
  const { leadId } = await params;
  const resolvedSearchParams = await searchParams;
  const lead = await getLeadDetailViewData(leadId);
  const workflowErrorCode = parseLeadWorkflowErrorCode(
    resolvedSearchParams.workflowError,
  );
  const workflowErrorMessage = workflowErrorCode
    ? getLeadWorkflowErrorUserMessage(workflowErrorCode)
    : null;

  if (!lead) {
    notFound();
  }

  return (
    <main>
      <PageHeader
        eyebrow={lead.source}
        title={lead.name}
        description={`${lead.property} | ${lead.status} | ${lead.contactMethod}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <form action={evaluateLeadAction.bind(null, lead.id)}>
              <button
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!lead.actions.evaluateFit}
                type="submit"
              >
                Evaluate fit
              </button>
            </form>
            <form action={requestInfoAction.bind(null, lead.id)}>
              <button
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!lead.actions.requestInfo}
                type="submit"
              >
                Request info
              </button>
            </form>
            <form action={scheduleTourAction.bind(null, lead.id)}>
              <button
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!lead.actions.scheduleTour}
                type="submit"
              >
                Schedule tour
              </button>
            </form>
            <form action={sendApplicationAction.bind(null, lead.id)}>
              <button
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!lead.actions.sendApplication}
                type="submit"
              >
                Send application
              </button>
            </form>
          </div>
        }
      />
      {workflowErrorMessage ? (
        <div className="mb-5 rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.12)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          {workflowErrorMessage}
        </div>
      ) : null}
      {lead.automationSuppressionSummaries.length > 0 ? (
        <div className="mb-5 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-[var(--shadow-panel)]">
          <div className="text-sm font-semibold">Automation suppression reasons</div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Manual outbound remains available, but these automated actions are currently blocked.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {lead.automationSuppressionSummaries.map((summary) => (
              <div
                key={summary.actionKey}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
              >
                <div className="text-sm font-medium">{summary.actionLabel}</div>
                <div className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
                  {summary.reasons.map((reason) => (
                    <div key={`${summary.actionKey}-${reason}`}>{reason}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          {lead.possibleDuplicateCandidate ? (
            <div className="rounded-[2rem] border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] p-6 shadow-[var(--shadow-panel)]">
              <div className="text-lg font-semibold">Possible duplicate lead</div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                This lead matched an existing record with medium confidence. Confirm if this
                should be treated as a duplicate.
              </p>
              <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                <div className="font-medium">
                  <Link
                    className="underline decoration-[var(--color-line)] underline-offset-4"
                    href={`/app/leads/${lead.possibleDuplicateCandidate.id}`}
                  >
                    {lead.possibleDuplicateCandidate.name}
                  </Link>
                </div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  {lead.possibleDuplicateCandidate.status} |{" "}
                  {lead.possibleDuplicateCandidate.source} |{" "}
                  {lead.possibleDuplicateCandidate.property} |{" "}
                  {lead.possibleDuplicateCandidate.lastActivity}
                </div>
              </div>
              <form
                action={confirmDuplicateLeadAction.bind(null, lead.id)}
                className="mt-4"
              >
                <input
                  type="hidden"
                  name="candidateLeadId"
                  value={lead.possibleDuplicateCandidate.id}
                />
                <input type="hidden" name="redirectTo" value={`/app/leads/${lead.id}`} />
                <button
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!lead.actions.confirmDuplicate}
                  type="submit"
                >
                  Confirm duplicate and archive this lead
                </button>
              </form>
            </div>
          ) : null}

          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-lg font-semibold">Summary</div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-[var(--color-muted)]">Assigned property</dt>
                <dd className="mt-1 font-medium">{lead.property}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--color-muted)]">Move-in date</dt>
                <dd className="mt-1 font-medium">{lead.moveInDate}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--color-muted)]">Budget</dt>
                <dd className="mt-1 font-medium">{lead.budget}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--color-muted)]">Stay length</dt>
                <dd className="mt-1 font-medium">{lead.stayLength}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--color-muted)]">Work status</dt>
                <dd className="mt-1 font-medium">{lead.workStatus}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-[var(--color-muted)]">Scheduling handoff</dt>
                <dd className="mt-1 font-medium">
                  {lead.schedulingUrl ? (
                    <a
                      className="text-[var(--color-accent-strong)] underline-offset-4 hover:underline"
                      href={lead.schedulingUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {lead.schedulingUrl}
                    </a>
                  ) : (
                    "Property scheduling link not configured"
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-[var(--color-muted)]">{lead.notes}</p>
            {lead.availableProperties.length > 0 &&
            lead.property === "Unassigned" &&
            lead.actions.assignProperty ? (
              <form
                action={assignLeadPropertyAction.bind(null, lead.id)}
                className="mt-6 flex flex-wrap items-end gap-3"
              >
                <label className="min-w-56 space-y-2">
                  <span className="text-sm font-medium">Assign property</span>
                  <select
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="propertyId"
                    required
                    defaultValue=""
                  >
                    <option disabled value="">
                      Choose property
                    </option>
                    {lead.availableProperties.map((propertyOption) => (
                      <option key={propertyOption.id} value={propertyOption.id}>
                        {propertyOption.name}
                      </option>
                    ))}
                  </select>
                </label>
                <input type="hidden" name="redirectTo" value={`/app/leads/${lead.id}`} />
                <button
                  className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Assign property
                </button>
              </form>
            ) : null}

            {lead.actions.overrideFit ? (
              <form
                action={overrideLeadRoutingAction.bind(null, lead.id)}
                className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              >
                <div className="text-sm font-semibold">Manual override</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Status
                    </span>
                    <select
                      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      name="overrideStatus"
                      defaultValue={lead.statusValue}
                      required
                    >
                      {[
                        "NEW",
                        "AWAITING_RESPONSE",
                        "INCOMPLETE",
                        "UNDER_REVIEW",
                        "CAUTION",
                        "QUALIFIED",
                        "TOUR_SCHEDULED",
                        "APPLICATION_SENT",
                        "DECLINED",
                        "ARCHIVED",
                        "CLOSED",
                      ].map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Fit
                    </span>
                    <select
                      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      name="overrideFit"
                      defaultValue={lead.fitValue}
                      required
                    >
                      {["UNKNOWN", "PASS", "CAUTION", "MISMATCH"].map((fitOption) => (
                        <option key={fitOption} value={fitOption}>
                          {fitOption}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Reason
                  </span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="overrideReason"
                    placeholder="Explain why this override is needed."
                    required
                    type="text"
                  />
                </label>
                <input type="hidden" name="redirectTo" value={`/app/leads/${lead.id}`} />
                <button
                  className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium"
                  type="submit"
                >
                  Apply override
                </button>
              </form>
            ) : null}

            {lead.actions.declineLead ? (
              <form
                action={declineLeadAction.bind(null, lead.id)}
                className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] p-4"
              >
                <div className="text-sm font-semibold">Decline lead</div>
                <label className="mt-3 block space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Decline reason
                  </span>
                  <select
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="declineReason"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select reason
                    </option>
                    {[
                      "RULE_MISMATCH",
                      "MISSING_INFO",
                      "OPERATOR_DECISION",
                      "NO_AVAILABILITY",
                      "UNRESPONSIVE",
                      "DUPLICATE",
                      "WITHDREW",
                    ].map((declineReasonOption) => (
                      <option key={declineReasonOption} value={declineReasonOption}>
                        {declineReasonOption.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Note
                  </span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="declineNote"
                    placeholder="Optional context for the timeline."
                    type="text"
                  />
                </label>
                <input type="hidden" name="redirectTo" value={`/app/leads/${lead.id}`} />
                <button
                  className="mt-3 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Decline lead
                </button>
              </form>
            ) : null}

            {lead.actions.manualOutbound ? (
              <form
                action={sendManualOutboundMessageAction.bind(null, lead.id)}
                className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              >
                <div className="text-sm font-semibold">Internal note</div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Save private operator context directly on the lead thread without sending anything externally.
                </p>
                {lead.availableInternalNoteMentions.length > 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    Mention teammates with {lead.availableInternalNoteMentions.map((mention) => `@${mention.canonicalHandle}`).join(", ")}.
                  </p>
                ) : null}
                <input type="hidden" name="manualChannel" value="INTERNAL_NOTE" />
                <input type="hidden" name="redirectTo" value={`/app/leads/${lead.id}`} />
                <label className="mt-3 block space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Note
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="manualBody"
                    placeholder="Capture context, objections, follow-up plans, or team-only guidance. Use @teammate to tag someone."
                    required
                  />
                </label>
                <button
                  className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium"
                  type="submit"
                >
                  Save note
                </button>
              </form>
            ) : null}

            {lead.actions.manualOutbound ? (
              <form
                action={sendManualOutboundMessageAction.bind(null, lead.id)}
                className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              >
                <div className="text-sm font-semibold">Manual outbound</div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Operator-initiated messages stay available even when automation is blocked.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Channel
                    </span>
                    <select
                      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      name="manualChannel"
                      required
                      defaultValue="EMAIL"
                    >
                      {["EMAIL", "SMS"].map((manualChannelOption) => (
                        <option key={manualChannelOption} value={manualChannelOption}>
                          {manualChannelOption.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Subject
                    </span>
                    <input
                      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      name="manualSubject"
                      placeholder="Optional subject"
                      type="text"
                    />
                  </label>
                </div>
                <label className="mt-3 block space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Message
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="manualBody"
                    placeholder="Write the manual outbound message."
                    required
                  />
                </label>
                <input type="hidden" name="redirectTo" value={`/app/leads/${lead.id}`} />
                <button
                  className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium"
                  type="submit"
                >
                  Send manual message
                </button>
              </form>
            ) : null}
          </div>

          {lead.normalizedFieldMetadataRows.length > 0 ? (
            <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
              <div className="text-lg font-semibold">Extraction confidence</div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Normalized lead fields from inbound parsing with confidence and source.
              </p>
              <div className="mt-4 space-y-3">
                {lead.normalizedFieldMetadataRows.map((fieldRow) => (
                  <div
                    key={fieldRow.key}
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{fieldRow.label}</div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                        {fieldRow.confidencePercent}% confidence
                      </div>
                    </div>
                    <div className="mt-2 text-sm">{fieldRow.value}</div>
                    <div className="mt-2 text-xs text-[var(--color-muted)]">
                      source: {fieldRow.source} | updated: {fieldRow.lastUpdatedAt}
                      {fieldRow.isSuggested ? " | suggested review" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">House-rule fit</div>
              <div className="rounded-full bg-[var(--color-sidebar)] px-3 py-1 text-sm text-white">
                {lead.fit}
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--color-muted)]">
              {lead.evaluationSummary}
            </p>
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
              Recommended status after evaluation:{" "}
              <span className="font-medium">{lead.recommendedStatus}</span>
            </div>
            <div className="mt-4 space-y-3">
              {lead.evaluationIssues.map((issue) => (
                <div
                  key={`${issue.label}-${issue.detail}`}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{issue.label}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      {issue.severity} | {issue.outcome}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    {issue.detail}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {lead.qualificationAnswers.map((answer) => (
                <div
                  key={answer.label}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3"
                >
                  <div className="text-sm text-[var(--color-muted)]">{answer.label}</div>
                  <div className="mt-1 font-medium">{answer.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-lg font-semibold">Timeline</div>
            <div className="mt-4 space-y-3">
              {lead.timeline.map((item) => (
                <div key={`${item.at}-${item.event}`} className="flex gap-4">
                  <div className="w-24 shrink-0 text-sm text-[var(--color-muted)]">
                    {item.at}
                  </div>
                  <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3">
                    {item.event}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
              <div className="text-lg font-semibold">Messages</div>
              <div className="mt-4 space-y-3">
              {lead.messages.map((message: (typeof lead.messages)[number]) => (
                <div
                  key={`${message.at}-${message.direction}-${message.channel}`}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                    {message.channel} | {message.direction} | {message.at}
                  </div>
                  {message.deliveryStatusLabel ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                      <span className="rounded-full border border-[var(--color-line)] px-3 py-1">
                        {message.deliveryStatusLabel}
                      </span>
                      {message.deliveryStatusDetail ? <span>{message.deliveryStatusDetail}</span> : null}
                    </div>
                  ) : null}
                  <div className="mt-2 text-sm leading-7">{message.body}</div>
                  {message.deliveryStatusError ? (
                    <div className="mt-3 text-xs text-[var(--color-accent-strong)]">
                      Delivery issue: {message.deliveryStatusError}
                    </div>
                  ) : null}
                  {message.mentionedTeammates.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                      {message.mentionedTeammates.map((mention) => (
                        <span
                          key={`${message.at}-${mention.userId}`}
                          className="rounded-full border border-[var(--color-line)] px-3 py-1"
                        >
                          @{mention.canonicalHandle} | {mention.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
