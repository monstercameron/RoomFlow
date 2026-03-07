import Link from "next/link";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { onboardingSteps } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";

export default async function OnboardingHubPage() {
  const membership = await getCurrentWorkspaceMembership();
  const property = await prisma.property.findFirst({
    where: {
      workspaceId: membership.workspaceId,
    },
    include: {
      rules: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const leadSources = await prisma.leadSource.findMany({
    where: {
      workspaceId: membership.workspaceId,
    },
  });

  const stepState = {
    "/onboarding/property": Boolean(property),
    "/onboarding/house-rules": Boolean(property && property.rules.length > 0),
    "/onboarding/channels": leadSources.length > 0,
  } as const;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 md:px-8">
      <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10">
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Onboarding
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Get the first property live in three steps
        </h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {onboardingSteps.map((step, index) => (
            <Link
              key={step.href}
              href={step.href}
              className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
                  Step {index + 1}
                </div>
                <div className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-medium">
                  {stepState[step.href as keyof typeof stepState]
                    ? "Complete"
                    : "Needs setup"}
                </div>
              </div>
              <div className="mt-3 text-xl font-semibold">{step.label}</div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                {step.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
