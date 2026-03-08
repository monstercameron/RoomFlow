import Link from "next/link";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getAuthenticatedRedirectPath } from "@/lib/app-data";
import { getServerSession } from "@/lib/session";

export default async function ResetPasswordPage() {
  const session = await getServerSession();

  if (session) {
    redirect(await getAuthenticatedRedirectPath());
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-3xl rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10">
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Reset password
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Choose a new password for this operator account.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          Use the reset link from email or local server logs, then set a replacement password here.
        </p>
        <ResetPasswordForm />
        <div className="mt-4 text-sm text-[var(--color-muted)]">
          Need another link?{" "}
          <Link className="font-medium text-[var(--color-accent-strong)]" href="/forgot-password">
            Request a new reset email
          </Link>
        </div>
      </div>
    </main>
  );
}