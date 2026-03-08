import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PublicCard, PublicPageShell } from "@/components/public-site";

export default async function EmbeddedQualificationPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <PublicPageShell
      eyebrow="Embedded qualification"
      title={`Embedded qualification form for ${workspaceSlug}.`}
      description="This is the lightweight, brand-safe version of the intake flow for external sites, landing pages, and listing widgets."
      ctaHref={`/capture/${workspaceSlug}`}
      ctaLabel="Open full lead form"
    >
      <PublicCard title="Embedded fields">
        <form className="space-y-4">
          <Input name="moveInDate" placeholder="Preferred move-in date" />
          <Input name="budget" placeholder="Monthly budget" inputMode="numeric" />
          <Select name="smoking" defaultValue="">
            <option disabled value="">
              Smoking preference
            </option>
            <option value="no">Non-smoking</option>
            <option value="outside-only">Outside only</option>
            <option value="yes">Smoking okay</option>
          </Select>
          <Select name="pets" defaultValue="">
            <option disabled value="">
              Pets
            </option>
            <option value="none">No pets</option>
            <option value="cat">Cat</option>
            <option value="dog">Dog</option>
          </Select>
        </form>
      </PublicCard>
      <PublicCard title="Use case" accent="dark">
        <p>Operators can embed qualification gates on external websites before prospects ever hit the dashboard or inbox pipeline.</p>
      </PublicCard>
    </PublicPageShell>
  );
}
