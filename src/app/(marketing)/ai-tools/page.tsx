import Link from "next/link";
import { PublicCard, PublicPageShell } from "@/components/public-site";

const aiTools = [
  {
    slug: "reply-drafter",
    title: "Reply Drafter",
    summary: "Turn messy shared-housing inquiries into faster first replies.",
  },
  {
    slug: "rule-explainer",
    title: "Rule Explainer",
    summary: "Show how property rules shape caution and mismatch outcomes.",
  },
  {
    slug: "follow-up-planner",
    title: "Follow-up Planner",
    summary: "Map the next request-info, tour, or application handoff.",
  },
];

export default function AiToolsLandingPage() {
  return (
    <PublicPageShell
      eyebrow="AI acquisition funnels"
      title="Public AI tool pages that explain the work before the signup prompt."
      description="Phase 21 includes public-facing AI landing pages so operators can discover Roomflow through specific workflow outcomes rather than a generic product pitch."
      ctaHref="/signup"
      ctaLabel="Try Roomflow"
    >
      {aiTools.map((tool) => (
        <PublicCard key={tool.slug} title={tool.title}>
          <p>{tool.summary}</p>
          <Link className="inline-flex rounded-full bg-[var(--color-accent)] px-4 py-2 font-medium text-white" href={`/ai-tools/${tool.slug}`}>
            Open landing page
          </Link>
        </PublicCard>
      ))}
    </PublicPageShell>
  );
}
