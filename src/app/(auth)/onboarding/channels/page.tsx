import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { onboardingChannelOptions } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

export default async function ChannelOnboardingPage() {
  const membership = await getCurrentWorkspaceMembership();
  const existingSources = await prisma.leadSource.findMany({
    where: {
      workspaceId: membership.workspaceId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const selectedTypes = new Set(existingSources.map((source) => source.type));
  const directChannels = onboardingChannelOptions.filter(
    (channel) => channel.mode === "direct",
  );
  const sourceTagChannels = onboardingChannelOptions.filter(
    (channel) => channel.mode === "source_tag",
  );

  async function saveChannels(formData: FormData) {
    "use server";

    const workspaceMembership = await getCurrentWorkspaceMembership();
    const selectedOptions = onboardingChannelOptions.filter((option) => {
      if (option.type === "MANUAL") {
        return true;
      }

      return formData.get(option.key) === "on";
    });

    await prisma.leadSource.deleteMany({
      where: {
        workspaceId: workspaceMembership.workspaceId,
      },
    });

    await prisma.leadSource.createMany({
      data: selectedOptions.map((option) => ({
        workspaceId: workspaceMembership.workspaceId,
        name: option.name,
        type: option.type,
      })),
    });

    await prisma.workspace.update({
      where: {
        id: workspaceMembership.workspaceId,
      },
      data: {
        onboardingCompletedAt: new Date(),
      },
    });

    revalidatePath("/onboarding");
    revalidatePath("/app");
    revalidatePath("/app/settings");
    redirect("/app");
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 md:px-8">
      <form
        action={saveChannels}
        className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
            Step 4 of 5
          </div>
          <Link
            className="text-sm font-medium text-[var(--color-accent-strong)]"
            href="/onboarding/questions"
          >
            Back
          </Link>
        </div>
        <h1 className="mt-3 text-4xl font-semibold">Choose intake channels</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          V1 supports manual entry plus direct inbound email and SMS. Marketplace
          channels are stored as source tags only.
        </p>

        <div className="mt-8">
          <div className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Direct support
          </div>
          <div className="mt-3 grid gap-3">
            {directChannels.map((channel) => (
              <label
                key={channel.key}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{channel.label}</div>
                    <div className="mt-1 text-sm text-[var(--color-muted)]">
                      {channel.description}
                    </div>
                  </div>
                  <input
                    defaultChecked={
                      channel.type === "MANUAL" || selectedTypes.has(channel.type)
                    }
                    disabled={channel.type === "MANUAL"}
                    name={channel.key}
                    type="checkbox"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Source tag only
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {sourceTagChannels.map((channel) => (
              <label
                key={channel.key}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{channel.label}</div>
                    <div className="mt-1 text-sm text-[var(--color-muted)]">
                      {channel.description}
                    </div>
                  </div>
                  <input
                    defaultChecked={selectedTypes.has(channel.type)}
                    name={channel.key}
                    type="checkbox"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 font-medium text-white"
            type="submit"
          >
            Finish onboarding
          </button>
        </div>
      </form>
    </main>
  );
}
