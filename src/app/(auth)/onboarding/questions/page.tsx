import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { applyPropertyIntakeFormAction } from "@/lib/ai-actions";
import { findLatestAiArtifact, intakeFormGeneratorSchema } from "@/lib/ai-assist";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";

export default async function OnboardingQuestionsPage() {
  const membership = await getCurrentWorkspaceMembership();
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
  const latestQuestionSet = property.questionSets.at(-1) ?? null;

  if (!starterArtifact && !latestQuestionSet) {
    notFound();
  }

  const starterQuestions =
    starterArtifact?.status === "ready" ? starterArtifact.data.questions : [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 md:px-8">
      <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10">
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
          Review the starter qualification questions
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
          Roomflow translated your house rules into a first-pass question set so leads can be screened with the right context before channels go live.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="space-y-4">
            {starterArtifact?.status === "failed" ? (
              <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
                {starterArtifact.error}
              </div>
            ) : null}

            {starterArtifact?.status === "ready" ? (
              <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                      Starter set
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {starterArtifact.data.setName}
                    </h2>
                  </div>
                  <div className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-muted)]">
                    {starterArtifact.data.questions.length} questions
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                  {starterArtifact.data.rationale}
                </p>

                <div className="mt-5 space-y-3">
                  {starterQuestions.map((question, index) => (
                    <article
                      className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4"
                      key={`${question.fieldKey}-${index}`}
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
                    </article>
                  ))}
                </div>

                <form className="mt-6" action={applyPropertyIntakeFormAction.bind(null, property.id)}>
                  <input name="redirectTo" type="hidden" value="/onboarding/questions" />
                  <button
                    className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 font-medium text-white"
                    type="submit"
                  >
                    Apply starter questions
                  </button>
                </form>
              </div>
            ) : null}

            {latestQuestionSet ? (
              <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                      Active question set
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {latestQuestionSet.name}
                    </h2>
                  </div>
                  <div className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-muted)]">
                    {latestQuestionSet.questions.length} saved
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {latestQuestionSet.questions.map((question) => (
                    <article
                      className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4"
                      key={question.id}
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
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
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

            <Link
              className="flex items-center justify-center rounded-2xl bg-[var(--color-accent)] px-5 py-3 font-medium text-white"
              href="/onboarding/channels"
            >
              Continue to channels
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}