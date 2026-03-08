import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthenticatedRedirectPath } from "@/lib/app-data";
import { getServerSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getServerSession();

  if (session) {
    redirect(await getAuthenticatedRedirectPath());
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] shadow-[var(--shadow-panel)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-[var(--color-sidebar)] p-8 text-[var(--color-sidebar-ink)] md:p-10">
          <div className="text-xs uppercase tracking-[0.28em] text-[rgba(248,243,235,0.56)]">
            Roomflow
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Return to the lead queue without reopening five inboxes.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[rgba(248,243,235,0.72)]">
            Email/password auth is live for the first local implementation pass.
            Use the seeded account below or create your own.
          </p>
        </div>
        <div className="p-8 md:p-10">
          <div className="text-sm uppercase tracking-[0.24em] text-[var(--color-muted)]">
            Log in
          </div>
          <div className="mt-3 text-3xl font-semibold">Operator access</div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
            Test login is prefilled for local review.
          </div>
          <LoginForm />
          <div className="mt-4 text-sm text-[var(--color-muted)]">
            Need an account?{" "}
            <Link className="font-medium text-[var(--color-accent-strong)]" href="/signup">
              Start here
            </Link>
          </div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            Forgot your password?{" "}
            <Link className="font-medium text-[var(--color-accent-strong)]" href="/forgot-password">
              Reset it here
            </Link>
          </div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            Prefer passwordless recovery?{" "}
            <Link className="font-medium text-[var(--color-accent-strong)]" href="/magic-link">
              Email a magic link
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
