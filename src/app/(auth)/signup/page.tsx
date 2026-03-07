import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { getAuthenticatedRedirectPath } from "@/lib/app-data";
import { getServerSession } from "@/lib/session";

export default async function SignupPage() {
  const session = await getServerSession();

  if (session) {
    redirect(await getAuthenticatedRedirectPath());
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
        <SignupForm />
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
