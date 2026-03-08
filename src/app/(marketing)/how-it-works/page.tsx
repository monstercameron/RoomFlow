import { PublicCard, PublicPageShell } from "@/components/public-site";

const funnelStages = [
  {
    title: "1. Capture",
    body: "Inbound email, SMS, CSV imports, and public forms all land in one lead workflow with normalized source context.",
  },
  {
    title: "2. Qualify",
    body: "Roomflow checks required questions, property rules, and data quality before letting automation push a lead forward.",
  },
  {
    title: "3. Route",
    body: "Operators can request info, hand off tour scheduling, send an application, or hold a lead for review without losing the reasoning trail.",
  },
  {
    title: "4. Convert",
    body: "Prospects get branded status, booking, rules, and waitlist pages while the team keeps the audit log and next-step control plane.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicPageShell
      eyebrow="Lead funnel walkthrough"
      title="From first inquiry to next action, without the spreadsheet gap."
      description="Phase 21 makes the external journey visible too: branded intake, prospect self-service pages, and acquisition funnels that feed back into the operator workflow."
      ctaHref="/signup"
      ctaLabel="Start the workflow"
    >
      {funnelStages.map((stage, index) => (
        <PublicCard key={stage.title} title={stage.title} accent={index % 2 === 1 ? "dark" : "light"}>
          <p>{stage.body}</p>
        </PublicCard>
      ))}
    </PublicPageShell>
  );
}
