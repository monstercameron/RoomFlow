import { PublicCard, PublicPageShell } from "@/components/public-site";

export default async function BrandedSchedulingPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <PublicPageShell
      eyebrow="External scheduling"
      title={`Book a tour with ${workspaceSlug}.`}
      description="This branded scheduling page is ready for external handoff links, self-booking rules, and property-specific next-step guidance."
      ctaHref="/signup"
      ctaLabel="Create this flow"
    >
      <PublicCard title="Booking details" accent="dark">
        <p>Show available windows, meeting instructions, assigned teammate coverage, and what to bring before the tour.</p>
      </PublicCard>
      <PublicCard title="Prospect checklist">
        <p>Use this surface for quiet-hours-safe confirmations, calendar reminders, and branded instructions that reduce no-shows.</p>
      </PublicCard>
    </PublicPageShell>
  );
}
