import { PublicCard, PublicList, PublicPageShell } from "@/components/public-site";

const personalPlan = [
  "Single operator workspace",
  "Core qualification, inbox, templates, and AI assist",
  "Great for one property owner or small co-living operator",
  "Manual teammate workflows stay out of scope",
];

const orgPlan = [
  "Multi-user operations with org-grade workflows",
  "Advanced automations, shared routing, and premium integrations",
  "Better fit for portfolios, teams, and centralized operations",
  "Adds scale, permissions, and collaboration rather than hiding AI behind a paywall",
];

export default function PricingPage() {
  return (
    <PublicPageShell
      eyebrow="Pricing and packaging"
      title="Two plans, one product philosophy: AI in both, scale in Org."
      description="The public pricing story matches the current plan model in the app: Personal for solo operators, Org for teams, advanced automation, and broader integration depth."
      ctaHref="/signup"
      ctaLabel="Start with Personal"
    >
      <PublicCard title="Personal" accent="light">
        <p className="text-3xl font-semibold tracking-tight">For solo operators</p>
        <PublicList items={personalPlan} />
      </PublicCard>
      <PublicCard title="Org" accent="dark">
        <p className="text-3xl font-semibold tracking-tight">For coordinated teams</p>
        <PublicList items={orgPlan} />
      </PublicCard>
      <PublicCard title="Included in both">
        <PublicList
          items={[
            "Rule conflict explanations and AI drafting",
            "Shared-housing-specific qualification workflows",
            "Outbound email and SMS foundations",
            "Public acquisition pages that route prospects into the right workspace funnel",
          ]}
        />
      </PublicCard>
    </PublicPageShell>
  );
}
