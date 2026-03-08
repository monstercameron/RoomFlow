import { PublicCard, PublicPageShell } from "@/components/public-site";

function formatToolSlug(toolSlug: string) {
  return toolSlug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AiToolDetailPage({
  params,
}: {
  params: Promise<{ toolSlug: string }>;
}) {
  const { toolSlug } = await params;
  const toolLabel = formatToolSlug(toolSlug);

  return (
    <PublicPageShell
      eyebrow="AI tool landing page"
      title={`${toolLabel} for shared-housing operators.`}
      description="Each AI tool route can work as an SEO landing page, ad destination, or education-first funnel that leads into the actual product workflow."
      ctaHref="/pricing"
      ctaLabel="Compare plans"
    >
      <PublicCard title="What this tool should explain">
        <p>Outcome-driven framing, example before-and-after workflow snippets, and a clear path into the product without pretending the AI can replace operator judgment.</p>
      </PublicCard>
      <PublicCard title="Conversion block" accent="dark">
        <p>Show how the public AI surface connects to qualification rules, inbox follow-up, and auditable decisions once the operator signs up.</p>
      </PublicCard>
    </PublicPageShell>
  );
}
