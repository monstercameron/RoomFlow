import Link from "next/link";
import { redirect } from "next/navigation";
import { SocialSignInButton } from "@/components/auth/social-sign-in-button";
import { SignupForm } from "@/components/auth/signup-form";
import {
  buildAuthEntryPagePath,
  buildMagicLinkPagePath,
  getSocialAuthErrorMessage,
  normalizeApplicationPath,
} from "@/lib/auth-urls";
import { getAuthenticatedRedirectPath } from "@/lib/app-data";
import { getConfiguredSocialAuthProviderIds } from "@/lib/auth-providers";
import { getServerSession } from "@/lib/session";
import {
  buildWorkflow1InvitePath,
  buildWorkflow1Path,
  getWorkflow1Intent,
  getWorkflow1IntentChips,
} from "@/lib/workflow1";

type SignupPageProps = {
  searchParams: Promise<{
    callbackURL?: string;
    email?: string;
    error?: string;
    invite?: string;
    plan?: string;
    provider?: string;
    source?: string;
    utm_campaign?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const session = await getServerSession();
  const resolvedSearchParams = await searchParams;
  const workflow1Intent = getWorkflow1Intent({
    inviteToken: resolvedSearchParams.invite,
    plan: resolvedSearchParams.plan,
    source: resolvedSearchParams.source,
    utmCampaign: resolvedSearchParams.utm_campaign,
  });
  const callbackPath = normalizeApplicationPath(
    resolvedSearchParams.callbackURL ??
      (workflow1Intent.inviteToken
        ? buildWorkflow1InvitePath(workflow1Intent.inviteToken)
        : "/onboarding"),
  );
  const workflow1Chips = getWorkflow1IntentChips(workflow1Intent);
  const socialAuthErrorMessage = getSocialAuthErrorMessage({
    errorCode: resolvedSearchParams.error ?? null,
    providerId: resolvedSearchParams.provider ?? null,
  });
  const availableEntryProviderIds = getConfiguredSocialAuthProviderIds().filter(
    (providerId) =>
      providerId === "google" ||
      providerId === "facebook" ||
      providerId === "microsoft" ||
      providerId === "apple",
  );

  if (session) {
    redirect(resolvedSearchParams.callbackURL ? callbackPath : await getAuthenticatedRedirectPath());
  }

  const loginPath = buildAuthEntryPagePath({
    callbackPath,
    emailAddress: resolvedSearchParams.email,
    entryPath: "/login",
    inviteToken: workflow1Intent.inviteToken,
    plan: workflow1Intent.plan,
    source: workflow1Intent.source,
    utmCampaign: workflow1Intent.utmCampaign,
  });
  const magicLinkPath = buildMagicLinkPagePath({
    emailAddress: resolvedSearchParams.email,
    inviteToken: workflow1Intent.inviteToken,
    nextPath: callbackPath,
    plan: workflow1Intent.plan,
    source: workflow1Intent.source,
    utmCampaign: workflow1Intent.utmCampaign,
  });
  const signupCallbackPath = buildWorkflow1Path(callbackPath, workflow1Intent);
  const headline = workflow1Intent.inviteToken
    ? "Create the account tied to your invite."
    : workflow1Intent.plan === "org"
      ? "Create the workspace your operating team can grow into."
      : "Create the operator workspace that gets you to onboarding fast.";
  const body = workflow1Intent.inviteToken
    ? "Use the invited email address so Roomflow can land you in the right workspace context without extra cleanup later."
    : workflow1Intent.plan === "org"
      ? "Start with a workspace built for collaboration, then layer in roles and advanced automations when the team is ready."
      : "Roomflow keeps the first pass low-friction: create your operator account, bootstrap the workspace, then move straight into setup.";

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] shadow-[var(--shadow-panel)] md:grid-cols-[1fr_1.1fr]">
        <div className="bg-[linear-gradient(160deg,rgba(34,52,70,0.96),rgba(41,63,82,0.92),rgba(184,88,51,0.88))] p-8 text-[var(--color-sidebar-ink)] md:p-10">
          <div className="text-xs uppercase tracking-[0.3em] text-[rgba(248,243,235,0.68)]">
            Workflow 1
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            {headline}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[rgba(248,243,235,0.8)]">
            {body}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {workflow1Chips.map((chip) => (
              <span
                className="rounded-full border border-[rgba(248,243,235,0.22)] bg-[rgba(248,243,235,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(248,243,235,0.88)]"
                key={chip}
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="mt-8 space-y-3 rounded-[1.75rem] border border-[rgba(248,243,235,0.18)] bg-[rgba(14,23,32,0.22)] p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-[rgba(248,243,235,0.6)]">
              What happens next
            </div>
            <div className="text-sm leading-7 text-[rgba(248,243,235,0.84)]">
              Create the operator identity, keep the workspace context intact, and route the account into setup without asking for property details too early.
            </div>
          </div>
        </div>
        <div className="p-8 md:p-10">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
            Start free
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Create your Roomflow account
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
            Choose the fastest path in. Email-password and configured identity providers both land in the same workflow handoff.
          </p>
          {socialAuthErrorMessage ? (
            <div className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
              {socialAuthErrorMessage}
            </div>
          ) : null}
          {availableEntryProviderIds.length > 0 ? (
            <div className="mt-6 space-y-3">
              {availableEntryProviderIds.map((providerId) => (
                <SocialSignInButton
                  callbackPath={callbackPath}
                  defaultEmailAddress={resolvedSearchParams.email}
                  entryPath="/signup"
                  key={providerId}
                  providerId={providerId}
                  workflow1Intent={workflow1Intent}
                />
              ))}
            </div>
          ) : null}
          <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            <div className="h-px flex-1 bg-[var(--color-line)]" />
            <span>Or continue with email</span>
            <div className="h-px flex-1 bg-[var(--color-line)]" />
          </div>
          <SignupForm
            callbackPath={signupCallbackPath}
            defaultEmailAddress={resolvedSearchParams.email}
          />
          <div className="mt-4 text-sm text-[var(--color-muted)]">
            Already have access?{" "}
            <Link className="font-medium text-[var(--color-accent-strong)]" href={loginPath}>
              Log in
            </Link>
          </div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            Need passwordless recovery for an existing account?{" "}
            <Link className="font-medium text-[var(--color-accent-strong)]" href={magicLinkPath}>
              Email a magic link
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
