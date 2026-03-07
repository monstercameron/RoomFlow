import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { onboardingRulePresets } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

export default async function HouseRulesOnboardingPage() {
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

  if (!property) {
    redirect("/onboarding/property");
  }

  const activeRuleLabels = new Set(property.rules.map((rule) => rule.label));

  async function saveHouseRules(formData: FormData) {
    "use server";

    const workspaceMembership = await getCurrentWorkspaceMembership();
    const currentProperty = await prisma.property.findFirst({
      where: {
        workspaceId: workspaceMembership.workspaceId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!currentProperty) {
      redirect("/onboarding/property");
    }

    const selectedRules = onboardingRulePresets.filter(
      (rule) => formData.get(rule.key) === "on",
    );

    await prisma.propertyRule.deleteMany({
      where: {
        propertyId: currentProperty.id,
      },
    });

    if (selectedRules.length > 0) {
      await prisma.propertyRule.createMany({
        data: selectedRules.map((rule) => ({
          propertyId: currentProperty.id,
          label: rule.label,
          category: rule.category,
          description: rule.description,
          severity: rule.severity,
          autoDecline: rule.autoDecline,
          warningOnly: rule.severity === "WARNING",
        })),
      });
    }

    revalidatePath("/onboarding");
    revalidatePath("/app");
    revalidatePath(`/app/properties/${currentProperty.id}/rules`);
    redirect("/onboarding/channels");
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 md:px-8">
      <form
        action={saveHouseRules}
        className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)]"
      >
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Step 2
        </div>
        <h1 className="mt-3 text-4xl font-semibold">Define the rule set</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          These rules become the first fit screen for inbound leads at{" "}
          <span className="font-medium">{property.name}</span>.
        </p>

        <div className="mt-8 grid gap-3">
          {onboardingRulePresets.map((rule) => (
            <label
              key={rule.key}
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{rule.label}</span>
                <input
                  defaultChecked={activeRuleLabels.has(rule.label)}
                  name={rule.key}
                  type="checkbox"
                />
              </div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                {rule.description}
              </div>
            </label>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 font-medium text-white"
            type="submit"
          >
            Save and continue
          </button>
        </div>
      </form>
    </main>
  );
}
