import Link from "next/link";
import { redirect } from "next/navigation";
import { HouseRulesBuilder } from "@/components/onboarding/house-rules-builder";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import {
  buildHouseRulesOnboardingRetryPath,
  handleSaveHouseRulesOnboardingAction,
  HouseRulesOnboardingActionError,
} from "@/lib/workflow3-house-rules";
import {
  createEmptyWorkflow3CustomRuleDraft,
  getWorkflow3SuggestedRuleDrafts,
  hydrateWorkflow3CustomRulesFromQuery,
  hydrateWorkflow3DraftsFromExistingRules,
  hydrateWorkflow3RuleDraftsFromQuery,
} from "@/lib/workflow3-house-rules-config";

type HouseRulesOnboardingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HouseRulesOnboardingPage({
  searchParams,
}: HouseRulesOnboardingPageProps) {
  const membership = await getCurrentWorkspaceMembership();
  const resolvedSearchParams = await searchParams;
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

  if (!property) {
    redirect("/onboarding/property");
  }

  async function saveHouseRules(formData: FormData) {
    "use server";

    const workspaceMembership = await getCurrentWorkspaceMembership();

    if (workspaceMembership.workspaceId !== membership.workspaceId) {
      redirect("/onboarding/house-rules");
    }

    try {
      await handleSaveHouseRulesOnboardingAction(formData);
    } catch (error) {
      if (error instanceof HouseRulesOnboardingActionError) {
        redirect(buildHouseRulesOnboardingRetryPath(formData, error.message));
      }

      throw error;
    }
  }

  const existingDrafts = hydrateWorkflow3DraftsFromExistingRules({
    rules: property.rules,
  });
  const suggestedDrafts = getWorkflow3SuggestedRuleDrafts({
    parkingAvailable: property.parkingAvailable,
    petsAllowed: property.petsAllowed,
    propertyType: property.propertyType,
    sharedBathroomCount: property.sharedBathroomCount,
    smokingAllowed: property.smokingAllowed,
  });
  const baseRuleDrafts =
    property.rules.length > 0 ? existingDrafts.ruleDrafts : suggestedDrafts;
  const baseCustomRules =
    property.rules.length > 0
      ? existingDrafts.customRules
      : [createEmptyWorkflow3CustomRuleDraft()];
  const draftRuleState = hydrateWorkflow3RuleDraftsFromQuery(
    resolvedSearchParams,
    baseRuleDrafts,
  );
  const draftCustomRules = hydrateWorkflow3CustomRulesFromQuery(
    resolvedSearchParams,
    baseCustomRules,
  );

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 md:px-8">
      <form
        action={saveHouseRules}
        className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10"
        noValidate
      >
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
            Step 2 of 5
          </div>
          <Link
            className="text-sm font-medium text-[var(--color-accent-strong)]"
            href="/onboarding/property"
          >
            Back
          </Link>
        </div>
        <h1 className="mt-3 text-4xl font-semibold">Define the house rules</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          These rules become the first fit screen for inbound leads at{" "}
          <span className="font-medium">{property.name}</span>.
        </p>
        {resolvedSearchParams.error ? (
          <div className="mt-6 rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]" role="alert">
            {resolvedSearchParams.error}
          </div>
        ) : null}

        <HouseRulesBuilder
          customRules={draftCustomRules}
          propertyName={property.name}
          ruleDrafts={draftRuleState}
        />

        <div className="mt-8 flex justify-end">
          <button
            className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 font-medium text-white"
            type="submit"
          >
            Save rules and continue
          </button>
        </div>
      </form>
    </main>
  );
}
