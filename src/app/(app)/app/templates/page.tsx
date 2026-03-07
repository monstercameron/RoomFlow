import { PageHeader } from "@/components/page-header";
import { getTemplatesViewData } from "@/lib/app-data";

export default async function TemplatesPage() {
  const messageTemplates = await getTemplatesViewData();

  return (
    <main>
      <PageHeader
        eyebrow="Templates"
        title="Reusable messaging"
        description="The first cut is intentionally narrow: enough structure for initial reply, missing-info follow-up, scheduling invite, and decline copy."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {messageTemplates.map((template) => (
          <div
            key={template.id}
            className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
          >
            <div className="flex items-center justify-between">
              <div className="text-xl font-semibold">{template.name}</div>
              <div className="rounded-full bg-[var(--color-sidebar)] px-3 py-1 text-sm text-white">
                {template.channel}
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
              {template.purpose}
            </p>
            {template.subject ? (
              <div className="mt-4 text-sm font-medium">
                Subject: {template.subject}
              </div>
            ) : null}
            <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
              {template.preview}
            </p>
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Rendered preview
              </div>
              {template.rendered.subject ? (
                <div className="mt-2 text-sm font-medium">
                  Subject: {template.rendered.subject}
                </div>
              ) : null}
              <div className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
                {template.rendered.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
