import { PageHeader } from "@/components/page-header";
import {
  applyWorkflowTemplateAction,
  generateWorkflowTemplateAction,
} from "@/lib/ai-actions";
import { getTemplatesViewData } from "@/lib/app-data";

export default async function TemplatesPage() {
  const templateData = await getTemplatesViewData();
  const messageTemplates = templateData.templates;

  return (
    <main>
      <PageHeader
        eyebrow="Templates"
        title="Reusable messaging"
        description="Message templates now cover screening, tour, application, house-rules, onboarding, decline, waitlist, and follow-up copy."
      />

      {templateData.hasAiAssist ? (
        <div className="mb-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold">AI workflow-template generator</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Generate a reusable message template from recent workspace activity, then save it into the template library.
              </div>
            </div>
            <form action={generateWorkflowTemplateAction}>
              <input type="hidden" name="redirectTo" value="/app/templates" />
              <button
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                type="submit"
              >
                Generate template
              </button>
            </form>
          </div>
          {templateData.generatedWorkflowTemplate?.status === "failed" ? (
            <div className="mt-4 text-sm text-[var(--color-accent-strong)]">
              {templateData.generatedWorkflowTemplate.error}
            </div>
          ) : null}
          {templateData.generatedWorkflowTemplate?.status === "ready" ? (
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">
                    {templateData.generatedWorkflowTemplate.data.name}
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {templateData.generatedWorkflowTemplate.data.type} | {templateData.generatedWorkflowTemplate.data.channel}
                  </div>
                </div>
                <form action={applyWorkflowTemplateAction}>
                  <input type="hidden" name="redirectTo" value="/app/templates" />
                  <button
                    className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                    type="submit"
                  >
                    Save generated template
                  </button>
                </form>
              </div>
              {templateData.generatedWorkflowTemplate.data.subject ? (
                <div className="mt-4 text-sm font-medium">
                  Subject: {templateData.generatedWorkflowTemplate.data.subject}
                </div>
              ) : null}
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--color-muted)]">
                {templateData.generatedWorkflowTemplate.data.body}
              </div>
              <div className="mt-3 text-sm text-[var(--color-muted)]">
                {templateData.generatedWorkflowTemplate.data.rationale}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {messageTemplates.map((template) => (
          <div
            key={template.id}
            className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-semibold">{template.name}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                  <span className="rounded-full border border-[var(--color-line)] px-3 py-1">
                    {template.typeLabel}
                  </span>
                </div>
              </div>
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
