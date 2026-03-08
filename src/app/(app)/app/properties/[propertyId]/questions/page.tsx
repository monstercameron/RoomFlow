import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  applyPropertyIntakeFormAction,
  generatePropertyIntakeFormAction,
} from "@/lib/ai-actions";
import { getPropertyQuestionsViewData } from "@/lib/app-data";

type PropertyQuestionsPageProps = {
  params: Promise<{
    propertyId: string;
  }>;
};

export default async function PropertyQuestionsPage({
  params,
}: PropertyQuestionsPageProps) {
  const { propertyId } = await params;
  const property = await getPropertyQuestionsViewData(propertyId);

  if (!property) {
    notFound();
  }

  return (
    <main>
      <PageHeader
        eyebrow="Property questions"
        title={property.propertyName}
        description={`Qualification question sets are still a simple property-level configuration, but this now exposes the actual questions tied to each property. Current lifecycle: ${property.lifecycleStatus}.`}
      />

      {property.hasAiAssist ? (
        <div className="mb-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold">AI intake-form generator</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Generate a question set from the current property rules, then add it as a custom intake set.
              </div>
            </div>
            <form action={generatePropertyIntakeFormAction.bind(null, property.propertyId)}>
              <input
                type="hidden"
                name="redirectTo"
                value={`/app/properties/${property.propertyId}/questions`}
              />
              <button
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                type="submit"
              >
                Generate intake set
              </button>
            </form>
          </div>
          {property.intakeFormArtifact?.status === "failed" ? (
            <div className="mt-4 text-sm text-[var(--color-accent-strong)]">
              {property.intakeFormArtifact.error}
            </div>
          ) : null}
          {property.intakeFormArtifact?.status === "ready" ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                <div className="font-medium">{property.intakeFormArtifact.data.setName}</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  {property.intakeFormArtifact.data.rationale}
                </div>
              </div>
              {property.intakeFormArtifact.data.questions.map((question) => (
                <div
                  key={`${question.fieldKey}-${question.label}`}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium">{question.label}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      {question.type} | {question.required ? "Required" : "Optional"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    Field key: {question.fieldKey}
                  </div>
                </div>
              ))}
              <form action={applyPropertyIntakeFormAction.bind(null, property.propertyId)}>
                <input
                  type="hidden"
                  name="redirectTo"
                  value={`/app/properties/${property.propertyId}/questions`}
                />
                <button
                  className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Apply generated intake set
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {property.questionSets.map((set) => (
          <div
            key={set.id}
            className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-semibold">{set.name}</div>
              <div className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs">
                {set.isDefault ? "Default set" : "Custom set"}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {set.questions.map((question) => (
                <div
                  key={question.id}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium">{question.label}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      {question.type} | {question.required ? "Required" : "Optional"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    Field key: {question.fieldKey}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
