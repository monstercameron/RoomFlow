import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PublicCard, PublicPageShell } from "@/components/public-site";

export default async function WaitlistSignupPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <PublicPageShell
      eyebrow="Waitlist signup"
      title={`Stay in the loop with ${workspaceSlug}.`}
      description="When inventory is unavailable, this public page keeps the prospect in a structured funnel instead of dropping them into a dead end."
      ctaHref="/features"
      ctaLabel="See the full funnel"
    >
      <PublicCard title="Waitlist form">
        <form className="space-y-4">
          <Input name="fullName" placeholder="Full name" />
          <Input name="email" placeholder="Email address" type="email" />
          <Select name="moveInWindow" defaultValue="">
            <option disabled value="">
              Preferred move-in window
            </option>
            <option value="30-days">Within 30 days</option>
            <option value="60-days">Within 60 days</option>
            <option value="90-days">Within 90 days</option>
          </Select>
          <Textarea name="notes" placeholder="Budget, neighborhood, or roommate preferences" />
        </form>
      </PublicCard>
      <PublicCard title="Routing notes" accent="dark">
        <p>Workspace-scoped waitlist capture lets operators keep source attribution, branded messaging, and follow-up priority intact until inventory opens again.</p>
      </PublicCard>
    </PublicPageShell>
  );
}
