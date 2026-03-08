import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
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
