import Link from "next/link";
import { redirect } from "next/navigation";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { buildAuthEntryPagePath, buildMagicLinkPagePath, normalizeApplicationPath } from "@/lib/auth-urls";
import { getAuthenticatedRedirectPath } from "@/lib/app-data";
import { getServerSession } from "@/lib/session";
import { buildWorkflow1InvitePath, getWorkflow1Intent } from "@/lib/workflow1";

type MagicLinkPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
    invite?: string;
    next?: string;
    plan?: string;
    source?: string;
    status?: string;
    token?: string;
    utm_campaign?: string;
  }>;
};

export default async function MagicLinkPage({ searchParams }: MagicLinkPageProps) {
  const session = await getServerSession();
  const resolvedSearchParams = await searchParams;
  const workflow1Intent = getWorkflow1Intent({
    inviteToken: resolvedSearchParams.invite,
    plan: resolvedSearchParams.plan,
    source: resolvedSearchParams.source,
    utmCampaign: resolvedSearchParams.utm_campaign,
  });
  const nextPath = normalizeApplicationPath(
    resolvedSearchParams.next ??
      (workflow1Intent.inviteToken
        ? buildWorkflow1InvitePath(workflow1Intent.inviteToken)
        : "/app"),
  );

  if (session) {
    redirect(await getAuthenticatedRedirectPath());
  }

  if (resolvedSearchParams.token) {
    // The app route handles user-facing messaging, while Better Auth verifies
    // the single-use token and creates the session cookie.
    redirect(
      `/api/auth/magic-link/verify?token=${encodeURIComponent(resolvedSearchParams.token)}&callbackURL=${encodeURIComponent(
        nextPath,
      )}&errorCallbackURL=${encodeURIComponent(
        buildMagicLinkPagePath({
          emailAddress: resolvedSearchParams.email,
          inviteToken: workflow1Intent.inviteToken,
          nextPath,
          plan: workflow1Intent.plan,
          source: workflow1Intent.source,
          utmCampaign: workflow1Intent.utmCampaign,
        }),
      )}`,
    );
  }

  const signupPath = buildAuthEntryPagePath({
    callbackPath: nextPath,
    emailAddress: resolvedSearchParams.email,
    entryPath: "/signup",
    inviteToken: workflow1Intent.inviteToken,
    plan: workflow1Intent.plan,
    source: workflow1Intent.source,
    utmCampaign: workflow1Intent.utmCampaign,
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-3xl rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10">
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Magic link
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Sign in or recover access without entering a password.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          Roomflow will issue a short-lived, single-use sign-in link for the operator email address.
        </p>
        <MagicLinkForm
          emailAddress={resolvedSearchParams.email}
          nextPath={nextPath}
          errorCode={resolvedSearchParams.error}
          status={resolvedSearchParams.status === "sent" ? "sent" : null}
          workflow1Intent={workflow1Intent}
        />
        <div className="mt-4 text-sm text-[var(--color-muted)]">
          Need to create an account first?{" "}
          <Link className="font-medium text-[var(--color-accent-strong)]" href={signupPath}>
            Start here
          </Link>
        </div>
      </div>
    </main>
  );
}