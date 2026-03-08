import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { serializeAuditEventPayloadSummary } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

type AuditPageProps = {
  searchParams: Promise<{
    actor?: string;
    eventType?: string;
  }>;
};

function truncateAuditPayloadSummary(payloadSummary: string) {
  if (payloadSummary.length <= 240) {
    return payloadSummary;
  }

  return `${payloadSummary.slice(0, 237)}...`;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const currentWorkspaceMembership = await getCurrentWorkspaceMembership();
  const resolvedSearchParams = await searchParams;
  const actorFilter =
    typeof resolvedSearchParams.actor === "string" ? resolvedSearchParams.actor : "";
  const eventTypeFilter =
    typeof resolvedSearchParams.eventType === "string"
      ? resolvedSearchParams.eventType.trim()
      : "";

  const [workspaceMemberships, recentWorkspaceEvents, auditEvents] = await Promise.all([
    prisma.membership.findMany({
      where: {
        workspaceId: currentWorkspaceMembership.workspaceId,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId: currentWorkspaceMembership.workspaceId,
      },
      select: {
        eventType: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 250,
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId: currentWorkspaceMembership.workspaceId,
        actorUserId: actorFilter.length > 0 ? actorFilter : undefined,
        eventType: eventTypeFilter.length > 0 ? eventTypeFilter : undefined,
      },
      include: {
        actorUser: {
          select: {
            name: true,
          },
        },
        lead: {
          select: {
            fullName: true,
            id: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 120,
    }),
  ]);

  const availableEventTypes = [...new Set(recentWorkspaceEvents.map((event) => event.eventType))]
    .sort((leftValue, rightValue) => leftValue.localeCompare(rightValue));

  return (
    <main>
      <PageHeader
        eyebrow="Audit"
        title="Workspace audit history"
        description="Review sensitive workspace actions, narrow the log by teammate or event type, and trace who touched a lead, property, or team control."
      />

      <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-xl font-semibold">Filters</div>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
          This view focuses on the most recent workspace audit trail. Filter by teammate to inspect user-specific activity or by event type to isolate a narrow operational flow.
        </p>
        <form className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <label className="space-y-2">
            <span className="text-sm font-medium">Teammate</span>
            <select
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={actorFilter}
              name="actor"
            >
              <option value="">All teammates</option>
              {workspaceMemberships.map((workspaceMembership) => (
                <option key={workspaceMembership.userId} value={workspaceMembership.userId}>
                  {workspaceMembership.user.name} ({workspaceMembership.role.toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Event type</span>
            <select
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={eventTypeFilter}
              name="eventType"
            >
              <option value="">All event types</option>
              {availableEventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white md:self-end"
            type="submit"
          >
            Apply filters
          </button>
          <Link
            className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] md:self-end"
            href="/app/audit"
          >
            Reset
          </Link>
        </form>
      </section>

      <section className="mt-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Recent audit events</div>
            <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
              Showing {auditEvents.length} recent events for the current workspace.
            </p>
          </div>
          <div className="text-sm text-[var(--color-muted)]">
            Actor filter: {actorFilter.length > 0 ? "1 teammate selected" : "All teammates"}
            <br />
            Event filter: {eventTypeFilter.length > 0 ? eventTypeFilter : "All event types"}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {auditEvents.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
              No audit events match the current filters.
            </div>
          ) : (
            auditEvents.map((auditEvent) => {
              const payloadSummary = truncateAuditPayloadSummary(
                serializeAuditEventPayloadSummary(auditEvent.payload),
              );

              return (
                <article
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                  key={auditEvent.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{auditEvent.eventType}</div>
                      <div className="mt-1 text-sm text-[var(--color-muted)]">
                        Actor: {auditEvent.actorUser?.name ?? auditEvent.actorType.toLowerCase()}
                      </div>
                    </div>
                    <div className="text-sm text-[var(--color-muted)]">
                      {auditEvent.createdAt.toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-[var(--color-muted)] md:grid-cols-3">
                    <div>
                      <div className="font-medium text-[var(--color-ink)]">Lead</div>
                      {auditEvent.lead ? (
                        <Link className="mt-1 inline-flex text-[var(--color-accent-strong)]" href={`/app/leads/${auditEvent.lead.id}`}>
                          {auditEvent.lead.fullName}
                        </Link>
                      ) : (
                        <div className="mt-1">No lead attached</div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--color-ink)]">Property</div>
                      {auditEvent.property ? (
                        <Link className="mt-1 inline-flex text-[var(--color-accent-strong)]" href={`/app/properties/${auditEvent.property.id}`}>
                          {auditEvent.property.name}
                        </Link>
                      ) : (
                        <div className="mt-1">No property attached</div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--color-ink)]">Payload summary</div>
                      <div className="mt-1 break-words">{payloadSummary || "No payload attached"}</div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}