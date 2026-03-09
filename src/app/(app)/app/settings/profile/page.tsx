import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getCurrentWorkspaceState } from "@/lib/app-data";
import { getAccountMethodSettings } from "@/lib/auth-accounts";
import {
  changeProfileEmailAction,
  updateProfileNameAction,
} from "@/app/(app)/app/settings/profile/actions";

const primaryActionClassName =
  "inline-flex items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.24)] bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(141,63,33,0.22)] transition-colors duration-150 hover:bg-[var(--color-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]";

const secondaryActionClassName =
  "inline-flex items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.96)] px-4 py-3 text-sm font-medium !text-[var(--color-ink)] visited:!text-[var(--color-ink)] hover:!text-[var(--color-ink)] focus-visible:!text-[var(--color-ink)] active:!text-[var(--color-ink)] shadow-[0_8px_18px_rgba(93,64,39,0.06)] transition-[border-color,background-color,color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.2)] hover:bg-[linear-gradient(180deg,rgba(255,247,239,1),rgba(244,233,221,1))] hover:shadow-[0_12px_24px_rgba(93,64,39,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] disabled:cursor-not-allowed disabled:border-[var(--color-line)] disabled:bg-[rgba(244,238,229,0.9)] disabled:!text-[var(--color-muted)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:border-[var(--color-line)] disabled:hover:bg-[rgba(244,238,229,0.9)]";

function getProfileStatusMessage(profileStatus?: string) {
  if (profileStatus === "name-updated") {
    return "Profile name updated.";
  }

  if (profileStatus === "email-change-requested") {
    return "Email change started. Check the new inbox for a verification link or paste the security code below before the address switches.";
  }

  if (profileStatus === "email-updated") {
    return "Email address updated after verification.";
  }

  return null;
}

export default async function ProfileManagementPage(props: {
  searchParams: Promise<{
    profileError?: string;
    profileStatus?: string;
  }>;
}) {
  const workspaceState = await getCurrentWorkspaceState();
  const accountMethodSettings = await getAccountMethodSettings();
  const searchParameters = await props.searchParams;
  const profileStatusMessage = getProfileStatusMessage(searchParameters.profileStatus);
  const isMockEmailProvider = process.env.EMAIL_DELIVERY_PROVIDER === "mock";

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Profile management"
        description="Update the operator details attached to this workspace identity and use the linked security workspace for password or sign-in method changes."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link className={secondaryActionClassName} href="/app/settings">
              Return to settings
            </Link>
            <Link className={secondaryActionClassName} href="/app/settings/security">
              Open security settings
            </Link>
          </div>
        }
      />

      {searchParameters.profileError ? (
        <div className="mb-4 rounded-[2rem] border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm font-medium text-[var(--color-accent-strong)]">
            {searchParameters.profileError}
          </div>
        </div>
      ) : null}
      {profileStatusMessage ? (
        <div className="mb-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm font-medium text-[var(--color-ink)]">{profileStatusMessage}</div>
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] md:p-7">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Current name</div>
            <div className="mt-3 text-lg font-semibold text-[var(--color-ink)]">{workspaceState.user.name}</div>
          </div>
          <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Current email</div>
            <div className="mt-3 break-all text-lg font-semibold text-[var(--color-ink)]">{workspaceState.user.email}</div>
          </div>
          <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Sign-in coverage</div>
            <div className="mt-3 text-lg font-semibold text-[var(--color-ink)]">
              {accountMethodSettings.hasPasswordAccount ? "Password active" : "Password not added"}
            </div>
            <div className="mt-1 text-sm text-[var(--color-muted)]">
              {accountMethodSettings.linkedSocialAccounts.length} linked social method{accountMethodSettings.linkedSocialAccounts.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] md:p-7">
          <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">Profile details</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Update display name</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            This name is used across the authenticated workspace surfaces and account communications.
          </p>

          <form action={updateProfileNameAction} className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-ink)]">Display name</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]"
                defaultValue={workspaceState.user.name ?? ""}
                name="name"
                placeholder="Operator name"
                required
                type="text"
              />
            </label>
            <button className={primaryActionClassName} type="submit">
              Save profile name
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] md:p-7">
          <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">Email address</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Change sign-in email</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Changing the operator email sends a verification link and a one-time security code to the new inbox before the address becomes active.
          </p>

          <div className="mt-4 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4 text-sm text-[var(--color-muted)]">
            Current email: <span className="font-medium text-[var(--color-ink)]">{workspaceState.user.email}</span>
          </div>

          <form action={changeProfileEmailAction} className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-ink)]">New email</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]"
                name="newEmail"
                placeholder="name@roomflow.app"
                required
                type="email"
              />
            </label>
            <button className={primaryActionClassName} type="submit">
              Request email change
            </button>
          </form>

          <div className="mt-5 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Security code</div>
            <h3 className="mt-3 text-lg font-semibold text-[var(--color-ink)]">Verify the new email with a pasted code</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
              If you have the code from the new inbox, paste it here instead of opening the verification link in that mailbox.
            </p>
            <form action="/api/experimental/email-verification-codes/verify" className="mt-4 space-y-4" method="GET">
              <input name="returnTo" type="hidden" value="/app/settings/profile?profileStatus=email-change-requested" />
              <input name="surface" type="hidden" value="profile" />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">Security code</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.24em] outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]"
                  inputMode="text"
                  name="code"
                  placeholder="ABCD-EF12"
                  required
                  type="text"
                />
              </label>
              <button className={secondaryActionClassName} type="submit">
                Confirm new email with code
              </button>
            </form>
            {isMockEmailProvider ? (
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Local mock delivery is active, so the latest inbox message is visible in{" "}
                <Link className="font-medium text-[var(--color-accent-strong)]" href="/app/settings/integrations/mock-email">
                  the mock email inbox
                </Link>
                . For direct inspection, the experimental code endpoint is{" "}
                <Link
                  className="font-medium text-[var(--color-accent-strong)]"
                  href={`/api/experimental/email-verification-codes?email=${encodeURIComponent(workspaceState.user.email)}`}
                >
                  available here
                </Link>
                .
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] md:p-7">
        <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">Password and sign-in methods</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Password changes live in security settings</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
          Password setup, linked providers, and active session management already live in the dedicated security workspace. Keep profile edits here and sign-in changes there.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className={secondaryActionClassName} href="/app/settings/security">
            Manage password and sessions
          </Link>
          <Link className={secondaryActionClassName} href="/forgot-password">
            Start password recovery
          </Link>
        </div>
      </section>
    </main>
  );
}