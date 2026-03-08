import { PublicCard, PublicList, PublicPageShell } from "@/components/public-site";

const featureSections = [
  {
    title: "Qualification control",
    items: [
      "Property-specific rules and question sets",
      "Visible pass, caution, mismatch, and under-review routing",
      "Operator-safe reasoning before tours or applications",
    ],
  },
  {
    title: "Inbox and follow-through",
    items: [
      "Unified lead timeline with message history and audit events",
      "Template-driven outreach for missing info, tours, and applications",
      "Quiet-hours, daily send-cap, and opt-out enforcement",
    ],
  },
  {
    title: "Automation and integrations",
    items: [
      "Workflow builder foundations for repeatable next-step logic",
      "Outbound webhook fan-out and integration sync visibility",
      "Calendar, screening, AI, and messaging capability gates by plan",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <PublicPageShell
      eyebrow="Product details"
      title="Roomflow is built for the ugly middle of the room-rental funnel."
      description="The product is opinionated around intake chaos, rule-heavy shared housing, and the operator decisions that usually disappear into ad hoc messages and spreadsheets."
      ctaHref="/pricing"
      ctaLabel="Compare plans"
    >
      {featureSections.map((section) => (
        <PublicCard key={section.title} title={section.title}>
          <PublicList items={section.items} />
        </PublicCard>
      ))}
    </PublicPageShell>
  );
}
