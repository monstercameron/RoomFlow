import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getAuthenticatedRedirectPath } from "@/lib/app-data";
import { getServerSession } from "@/lib/session";

export default async function ForgotPasswordPage() {
  const session = await getServerSession();

  if (session) {
    redirect(await getAuthenticatedRedirectPath());
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-3xl rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10">
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Password recovery
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Reset operator access without touching the database.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          Enter the account email and Roomflow will issue a password reset link.
        </p>
        <ForgotPasswordForm />
        <div className="mt-4 text-sm text-[var(--color-muted)]">
          Back to sign in?{" "}
          <Link className="font-medium text-[var(--color-accent-strong)]" href="/login">
            Return to login
          </Link>
        </div>
        <div className="mt-2 text-sm text-[var(--color-muted)]">
          Want passwordless recovery instead?{" "}
          <Link className="font-medium text-[var(--color-accent-strong)]" href="/magic-link">
            Request a magic link
          </Link>
        </div>
      </div>
    </main>
  );
}