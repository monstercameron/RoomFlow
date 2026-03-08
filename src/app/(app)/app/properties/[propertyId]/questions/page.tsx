import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QualificationQuestionsBuilder } from "@/components/onboarding/qualification-questions-builder";
import { PageHeader } from "@/components/page-header";
import { generatePropertyIntakeFormAction } from "@/lib/ai-actions";
import { getPropertyQuestionsViewData } from "@/lib/app-data";
import { handleSaveWorkflow4QuestionsAction } from "@/lib/workflow4-questions-actions";
import {
  buildWorkflow4QuestionsRetryPath,
  hydrateWorkflow4DraftsFromSearchParams,
  mergeWorkflow4Drafts,
  Workflow4QuestionsActionError,
} from "@/lib/workflow4-questions";

type PropertyQuestionsPageProps = {
  params: Promise<{
    propertyId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PropertyQuestionsPage({
  params,
  searchParams,
}: PropertyQuestionsPageProps) {
  const { propertyId } = await params;
  const resolvedSearchParams = await searchParams;
  const property = await getPropertyQuestionsViewData(propertyId);

  if (!property) {
    notFound();
  }

  async function saveQuestions(formData: FormData) {
    "use server";

    try {
      await handleSaveWorkflow4QuestionsAction(
        formData,
        {
          propertyId,
          successPath: `/app/properties/${propertyId}/questions`,
        },
      );
    } catch (error) {
      if (error instanceof Workflow4QuestionsActionError) {
        redirect(
          buildWorkflow4QuestionsRetryPath({
            basePath: `/app/properties/${propertyId}/questions`,
            errorMessage: error.message,
            formData,
            redirectTo: `/app/properties/${propertyId}/questions`,
            source:
              typeof resolvedSearchParams.source === "string"
                ? resolvedSearchParams.source
                : null,
          }),
        );
      }

      throw error;
    }
  }

  const builderDrafts = mergeWorkflow4Drafts({
    activeQuestionSet: property.activeQuestionSet,
    artifact:
      property.intakeFormArtifact?.status === "ready"
        ? property.intakeFormArtifact.data
        : null,
    property: {
      name: property.propertyName,
      parkingAvailable: property.parkingAvailable,
      petsAllowed: property.petsAllowed,
      rentableRoomCount: property.rentableRoomCount,
      rules: property.rules.map((rule) => ({
        category: null,
        description: rule.description,
        label: rule.label,
      })),
      sharedBathroomCount: property.sharedBathroomCount,
      smokingAllowed: property.smokingAllowed,
    },
    queryState: hydrateWorkflow4DraftsFromSearchParams(resolvedSearchParams),
    source: typeof resolvedSearchParams.source === "string" ? resolvedSearchParams.source : null,
  });

  return (
    <main>
      <PageHeader
        eyebrow="Property questions"
        title={property.propertyName}
        description={`Edit the live qualification intake for this property and keep earlier versions as history. Current lifecycle: ${property.lifecycleStatus}.`}
      />

      {resolvedSearchParams.error ? (
        <div className="mb-4 rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]" role="alert">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      {property.hasAiAssist ? (
        <div className="mb-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold">AI intake-form generator</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Generate a fresh question starter from the current property rules, then pull it into the builder below.
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
              <Link
                className="inline-flex rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-ink)]"
                href={`/app/properties/${property.propertyId}/questions?source=ai`}
              >
                Pull AI starter into builder
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <form action={saveQuestions} noValidate>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Live intake
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {property.activeQuestionSet?.name ?? "Draft a qualification intake"}
              </div>
            </div>
            <button
              className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
              type="submit"
            >
              Save question set
            </button>
          </div>

          <QualificationQuestionsBuilder drafts={builderDrafts} propertyName={property.propertyName} />
        </div>

        {property.questionSetHistory.length > 0 ? (
          <div className="mt-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">Previous versions</div>
            <div className="mt-4 space-y-3">
              {property.questionSetHistory.map((set) => (
                <div
                  key={set.id}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium">{set.name}</div>
                    <div className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs">
                      Archived
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    {set.questions.length} questions in this version
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </main>
  );
}
