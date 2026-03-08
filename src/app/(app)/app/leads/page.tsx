import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getLeadListViewData } from "@/lib/app-data";

export default async function LeadsPage() {
  const leads = await getLeadListViewData();

  return (
    <main>
      <PageHeader
        eyebrow="Leads"
        title="Qualification queue"
        description="Structured lead list with the fields the README and sitemap require first: source, property, move-in timing, budget, fit, and recent activity."
      />

      <div className="overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] shadow-[var(--shadow-panel)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--color-line)] bg-[rgba(255,255,255,0.4)] text-[var(--color-muted)]">
            <tr>
              <th className="px-5 py-4 font-medium">Name</th>
              <th className="px-5 py-4 font-medium">Source</th>
              <th className="px-5 py-4 font-medium">Property</th>
              <th className="px-5 py-4 font-medium">Owner</th>
              <th className="px-5 py-4 font-medium">Move-in</th>
              <th className="px-5 py-4 font-medium">Budget</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Fit</th>
              <th className="px-5 py-4 font-medium">SLA</th>
              <th className="px-5 py-4 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-[var(--color-line)] last:border-b-0"
              >
                <td className="px-5 py-4 font-medium">
                  <Link
                    className="underline decoration-[var(--color-line)] underline-offset-4"
                    href={`/app/leads/${lead.id}`}
                    prefetch={false}
                  >
                    {lead.name}
                  </Link>
                </td>
                <td className="px-5 py-4">{lead.source}</td>
                <td className="px-5 py-4">{lead.property}</td>
                <td className="px-5 py-4">{lead.assignedTo}</td>
                <td className="px-5 py-4">{lead.moveInDate}</td>
                <td className="px-5 py-4">{lead.budget}</td>
                <td className="px-5 py-4">{lead.status}</td>
                <td className="px-5 py-4">{lead.fit}</td>
                <td className="px-5 py-4">
                  {lead.slaSummary ? (
                    <span className={lead.slaSummary.isOverdue ? "text-[var(--color-accent-strong)]" : "text-[var(--color-muted)]"}>
                      {lead.slaSummary.label} · {lead.slaSummary.dueAt}
                    </span>
                  ) : (
                    <span className="text-[var(--color-muted)]">-</span>
                  )}
                </td>
                <td className="px-5 py-4 text-[var(--color-muted)]">
                  {lead.lastActivity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
