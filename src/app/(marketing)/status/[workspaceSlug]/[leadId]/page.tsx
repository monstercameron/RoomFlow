import { PublicCard, PublicPageShell } from "@/components/public-site";

export default async function ProspectStatusPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; leadId: string }>;
}) {
  const { leadId, workspaceSlug } = await params;

  return (
    <PublicPageShell
      eyebrow="Prospect status"
      title={`Status update for inquiry ${leadId}.`}
      description={`This lightweight portal gives prospects clear next-step visibility without exposing the full operator workspace for ${workspaceSlug}.`}
      ctaHref={`/portal/${workspaceSlug}/invite-demo`}
      ctaLabel="Open portal shell"
    >
      <PublicCard title="Current step" accent="dark">
        <p>Awaiting qualification review</p>
        <p className="text-[rgba(248,243,235,0.75)]">The operator has your intake details and will confirm whether more information, a tour handoff, or an application is next.</p>
      </PublicCard>
      <PublicCard title="What prospects should see">
        <p>Status-safe summaries, missing items, tour handoff readiness, and any waitlist or rule-acknowledgment prompts.</p>
      </PublicCard>
    </PublicPageShell>
  );
}
