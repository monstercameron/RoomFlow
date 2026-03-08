import Link from "next/link";
import { redirect } from "next/navigation";
import { QualificationQuestionsBuilder } from "@/components/onboarding/qualification-questions-builder";
import { findLatestAiArtifact, intakeFormGeneratorSchema } from "@/lib/ai-assist";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import { handleSaveWorkflow4QuestionsAction } from "@/lib/workflow4-questions-actions";
import {
  buildWorkflow4QuestionsRetryPath,
  hydrateWorkflow4DraftsFromSearchParams,
  mergeWorkflow4Drafts,
  resolveActiveQualificationQuestionSet,
  Workflow4QuestionsActionError,
} from "@/lib/workflow4-questions";

type OnboardingQuestionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OnboardingQuestionsPage({
  searchParams,
}: OnboardingQuestionsPageProps) {
  const membership = await getCurrentWorkspaceMembership();
  const resolvedSearchParams = await searchParams;
  const property = await prisma.property.findFirst({
    where: {
      workspaceId: membership.workspaceId,
    },
    include: {
      questionSets: {
        include: {
          questions: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      rules: {
        where: {
          active: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!property) {
    redirect("/onboarding/property");
  }

  async function saveQuestions(formData: FormData) {
    "use server";

    const workspaceMembership = await getCurrentWorkspaceMembership();

    if (workspaceMembership.workspaceId !== membership.workspaceId) {
      redirect("/onboarding/questions");
    }

    try {
      await handleSaveWorkflow4QuestionsAction(
        formData,
        {
          successPath: "/onboarding/channels",
        },
      );
    } catch (error) {
      if (error instanceof Workflow4QuestionsActionError) {
        redirect(
          buildWorkflow4QuestionsRetryPath({
            basePath: "/onboarding/questions",
            errorMessage: error.message,
            formData,
            redirectTo: "/onboarding/channels",
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

  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      workspaceId: membership.workspaceId,
      propertyId: property.id,
      eventType: "ai_artifact_generated",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
      eventType: true,
      payload: true,
    },
  });
  const starterArtifact = findLatestAiArtifact({
    artifactKind: "intake_form_generator",
    auditEvents,
    schema: intakeFormGeneratorSchema,
  });
  const starterData = starterArtifact?.status === "ready" ? starterArtifact.data : null;
  const activeQuestionSetRecord = resolveActiveQualificationQuestionSet(property.questionSets);
  const activeQuestionSet = activeQuestionSetRecord
    ? {
        id: activeQuestionSetRecord.id,
        isDefault: activeQuestionSetRecord.isDefault,
        name: activeQuestionSetRecord.name,
        questions: activeQuestionSetRecord.questions.map((question) => ({
          id: question.id,
          fieldKey: question.fieldKey,
          label: question.label,
          options: Array.isArray(question.options)
            ? question.options.filter((option): option is string => typeof option === "string")
            : [],
          required: question.required,
          sortOrder: question.sortOrder,
          type: question.type,
        })),
      }
    : null;
  const builderDrafts = mergeWorkflow4Drafts({
    activeQuestionSet,
    artifact: starterData,
    property: {
      name: property.name,
      parkingAvailable: property.parkingAvailable,
      petsAllowed: property.petsAllowed,
      rentableRoomCount: property.rentableRoomCount,
      rules: property.rules.map((rule) => ({
        category: rule.category,
        description: rule.description,
        label: rule.label,
      })),
      sharedBathroomCount: property.sharedBathroomCount,
      smokingAllowed: property.smokingAllowed,
    },
    queryState: hydrateWorkflow4DraftsFromSearchParams(resolvedSearchParams),
    source: typeof resolvedSearchParams.source === "string" ? resolvedSearchParams.source : null,
  });
  const historicalQuestionSets = property.questionSets.filter(
    (questionSet) => !activeQuestionSetRecord || questionSet.id !== activeQuestionSetRecord.id,
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 md:px-8">
      <form
        action={saveQuestions}
        className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10"
        noValidate
      >
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
            Step 3 of 5
          </div>
          <Link
            className="text-sm font-medium text-[var(--color-accent-strong)]"
            href="/onboarding/house-rules"
          >
            Back
          </Link>
        </div>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Shape the qualification questions
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
          Build a practical intake flow for {property.name}. Keep the required questions tight, leave softer context as optional, and turn off anything that does not help you confirm fit.
        </p>

        {resolvedSearchParams.error ? (
          <div className="mt-6 rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]" role="alert">
            {resolvedSearchParams.error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="space-y-4">
            {starterArtifact?.status === "failed" ? (
              <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
                {starterArtifact.error}
              </div>
            ) : null}

            {starterData ? (
              <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                      AI starter
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {starterData.setName}
                    </h2>
                  </div>
                  <div className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-muted)]">
                    {starterData.questions.length} suggestions
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                  {starterData.rationale}
                </p>
                <Link
                  className="mt-5 inline-flex rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-ink)]"
                  href="/onboarding/questions?source=ai"
                >
                  Start from AI suggestions
                </Link>
              </div>
            ) : null}

            {activeQuestionSet ? (
              <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                      Current live intake
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {activeQuestionSet.name}
                    </h2>
                  </div>
                  <div className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-muted)]">
                    {activeQuestionSet.questions.length} active questions
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                  Editing below will publish a new active version and keep older versions as history.
                </p>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-[var(--color-line)] bg-white p-6">
                <div className="text-xl font-semibold">Start with a clean intake</div>
                <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
                  No question set is live yet. Use the guided builder below to create the first version even if AI suggestions are unavailable.
                </p>
              </div>
            )}

            <QualificationQuestionsBuilder drafts={builderDrafts} propertyName={property.name} />

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-[var(--color-muted)]">
                Save the live intake flow, then continue to channels.
              </div>
              <button
                className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 font-medium text-white"
                type="submit"
              >
                Save and continue
              </button>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-white p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                From your rules
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                Current screening signals
              </h2>
              <div className="mt-4 space-y-3">
                {property.rules.map((rule) => (
                  <div
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                    key={rule.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{rule.label}</div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
                        {rule.mode.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      {rule.description ?? "No additional detail provided."}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {historicalQuestionSets.length > 0 ? (
              <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-white p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  History
                </div>
                <div className="mt-4 space-y-3">
                  {historicalQuestionSets.slice(-3).reverse().map((questionSet) => (
                    <div
                      className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                      key={questionSet.id}
                    >
                      <div className="font-medium">{questionSet.name}</div>
                      <div className="mt-1 text-sm text-[var(--color-muted)]">
                        {questionSet.questions.length} questions archived
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </form>
    </main>
  );
}