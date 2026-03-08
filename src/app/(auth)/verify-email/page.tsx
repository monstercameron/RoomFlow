import Link from "next/link";
import { redirect } from "next/navigation";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import {
  buildEmailVerificationCallbackPath,
  normalizeApplicationPath,
} from "@/lib/auth-urls";
import { getAuthenticatedRedirectPath } from "@/lib/app-data";
import { getServerSession } from "@/lib/session";

type VerifyEmailPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
    next?: string;
    status?: string;
    token?: string;
  }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const session = await getServerSession();
  const resolvedSearchParams = await searchParams;
  const nextPath = normalizeApplicationPath(resolvedSearchParams.next);
  const emailAddress = resolvedSearchParams.email ?? session?.user.email;

  if (resolvedSearchParams.token) {
    // The app page owns the human-facing state, while Better Auth still performs
    // the actual token verification and session update.
    redirect(
      `/api/auth/verify-email?token=${encodeURIComponent(resolvedSearchParams.token)}&callbackURL=${encodeURIComponent(
        buildEmailVerificationCallbackPath({ nextPath }),
      )}`,
    );
  }

  if (session?.user.emailVerified) {
    if (resolvedSearchParams.status === "verified") {
      redirect(nextPath);
    }

    redirect(await getAuthenticatedRedirectPath());
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-3xl rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10">
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Verify email
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Confirm this operator email before entering the workspace.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          Roomflow holds dashboard and onboarding access until the inbox owner proves they control this email address.
        </p>
        <VerifyEmailPanel
          emailAddress={emailAddress}
          nextPath={nextPath}
          verificationErrorCode={resolvedSearchParams.error}
          verificationStatus={resolvedSearchParams.status === "verified" ? "verified" : null}
        />
        <div className="mt-4 text-sm text-[var(--color-muted)]">
          Need another account instead?{" "}
          <Link className="font-medium text-[var(--color-accent-strong)]" href="/signup">
            Create a new operator account
          </Link>
        </div>
        <div className="mt-2 text-sm text-[var(--color-muted)]">
          Back to login?{" "}
          <Link className="font-medium text-[var(--color-accent-strong)]" href="/login">
            Return to login
          </Link>
        </div>
      </div>
    </main>
  );
}