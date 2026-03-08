import Link from "next/link";
import { PublicCard, PublicPageShell } from "@/components/public-site";

export default async function ProspectPortalShellPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; inviteToken: string }>;
}) {
  const { inviteToken, workspaceSlug } = await params;

  return (
    <PublicPageShell
      eyebrow="Prospect portal shell"
      title={`Prospect portal for ${workspaceSlug}.`}
      description={`Invite token ${inviteToken} opens the branded shell for appointments, acknowledgments, and prospect-visible next steps without exposing the internal operator workspace.`}
      ctaHref={`/status/${workspaceSlug}/demo-lead`}
      ctaLabel="View status page"
    >
      <PublicCard title="Portal modules">
        <ul className="space-y-3">
          <li className="rounded-2xl border border-[var(--color-line)] bg-white/70 px-4 py-3">Upcoming appointments</li>
          <li className="rounded-2xl border border-[var(--color-line)] bg-white/70 px-4 py-3">House-rules acknowledgments</li>
          <li className="rounded-2xl border border-[var(--color-line)] bg-white/70 px-4 py-3">Application and screening next steps</li>
        </ul>
      </PublicCard>
      <PublicCard title="Portal navigation" accent="dark">
        <p>Use the portal shell as the stable frame for later invite acceptance, status visibility, and time-bound prospect actions.</p>
        <Link className="inline-flex rounded-full bg-[rgba(248,243,235,0.14)] px-4 py-2 font-medium text-white ring-1 ring-[rgba(248,243,235,0.18)]" href="/how-it-works">
          See the full funnel
        </Link>
      </PublicCard>
    </PublicPageShell>
  );
}
