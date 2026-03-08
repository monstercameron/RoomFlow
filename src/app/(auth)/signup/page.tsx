import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SignupForm } from "@/components/auth/signup-form";
import {
  getSocialAuthErrorMessage,
  normalizeApplicationPath,
} from "@/lib/auth-urls";
import { getAuthenticatedRedirectPath } from "@/lib/app-data";
import { getConfiguredSocialAuthProviderIds } from "@/lib/auth-providers";
import { getServerSession } from "@/lib/session";

type SignupPageProps = {
  searchParams: Promise<{
    callbackURL?: string;
    email?: string;
    error?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const session = await getServerSession();
  const resolvedSearchParams = await searchParams;
  const callbackPath = normalizeApplicationPath(resolvedSearchParams.callbackURL ?? "/onboarding");
  const socialAuthErrorMessage = getSocialAuthErrorMessage(resolvedSearchParams.error ?? null);
  const isGoogleLoginAvailable = getConfiguredSocialAuthProviderIds().includes("google");

  if (session) {
    redirect(resolvedSearchParams.callbackURL ? callbackPath : await getAuthenticatedRedirectPath());
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-3xl rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10">
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Start free
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Create the first operator workspace
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          The initial build path is single-workspace and single-operator first.
          Team roles, billing, and external integrations come later.
        </p>
        {socialAuthErrorMessage ? (
          <div className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
            {socialAuthErrorMessage}
          </div>
        ) : null}
        {isGoogleLoginAvailable ? (
          <GoogleSignInButton
            callbackPath={callbackPath}
            defaultEmailAddress={resolvedSearchParams.email}
            entryPath="/signup"
          />
        ) : null}
        <SignupForm
          callbackPath={callbackPath}
          defaultEmailAddress={resolvedSearchParams.email}
        />
        <div className="mt-4 text-sm text-[var(--color-muted)]">
          Already have access?{" "}
          <Link className="font-medium text-[var(--color-accent-strong)]" href="/login">
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
