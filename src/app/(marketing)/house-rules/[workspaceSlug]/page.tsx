import { PublicCard, PublicPageShell } from "@/components/public-site";

const exampleRules = [
  "No indoor smoking",
  "Respect quiet hours after 10:00 PM",
  "Shared kitchen cleanup expected after use",
  "Parking availability varies by property",
];

export default async function HouseRulesAcknowledgmentPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <PublicPageShell
      eyebrow="House rules acknowledgment"
      title={`Shared-house expectations for ${workspaceSlug}.`}
      description="This page gives prospects a clean, branded place to review expectations before they book, apply, or move deeper into screening."
      ctaHref="/signup"
      ctaLabel="Add branded rule pages"
    >
      <PublicCard title="Current expectations">
        <ul className="space-y-3">
          {exampleRules.map((rule) => (
            <li key={rule} className="rounded-2xl border border-[var(--color-line)] bg-white/70 px-4 py-3">
              {rule}
            </li>
          ))}
        </ul>
      </PublicCard>
      <PublicCard title="Acknowledgment intent" accent="dark">
        <p>Later wiring can capture explicit acknowledgment timestamps, rule-version snapshots, and attached operator notes for compliance-sensitive flows.</p>
      </PublicCard>
    </PublicPageShell>
  );
}
