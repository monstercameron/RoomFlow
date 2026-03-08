import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PublicCard, PublicPageShell } from "@/components/public-site";

export default async function PublicLeadCapturePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <PublicPageShell
      eyebrow="Public lead capture"
      title={`Capture inquiries directly for ${workspaceSlug}.`}
      description="This route is the secure workspace-routed entry point for external inquiries, referral microsites, and listing-link follow-up flows."
      ctaHref={`/embed/${workspaceSlug}/qualification`}
      ctaLabel="View embedded variant"
    >
      <PublicCard title="Inquiry form">
        <form className="space-y-4">
          <Input name="fullName" placeholder="Full name" />
          <Input name="email" placeholder="Email address" type="email" />
          <Input name="phone" placeholder="Phone number" type="tel" />
          <Select name="contactPreference" defaultValue="">
            <option disabled value="">
              Preferred contact channel
            </option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </Select>
          <Textarea name="message" placeholder="What kind of room or shared-house setup are you looking for?" />
        </form>
      </PublicCard>
      <PublicCard title="Secure routing intent" accent="dark">
        <p>The route slug anchors the intake to the correct workspace, preserving separation between operator funnels while remaining safe for public sharing.</p>
      </PublicCard>
    </PublicPageShell>
  );
}
