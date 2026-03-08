import {
  linkSocialAccountAction,
  setPasswordAction,
  unlinkAccountAction,
} from "@/app/(app)/app/settings/security/actions";
import type {
  AvailableSocialAuthProvider,
  LinkedAccountRecord,
} from "@/lib/auth-accounts";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTimestamp(timestampValue: Date) {
  return dateTimeFormatter.format(new Date(timestampValue));
}

export function AccountMethodsPanel(props: {
  availableSocialProviders: AvailableSocialAuthProvider[];
  hasPasswordAccount: boolean;
  linkedAccounts: LinkedAccountRecord[];
  statusMessage?: string | null;
  errorMessage?: string | null;
}) {
  const linkedSocialAccounts = props.linkedAccounts.filter(
    (linkedAccount) => linkedAccount.providerId !== "credential",
  );

  return (
    <section className="space-y-4">
      <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-xl font-semibold">Sign-in methods</div>
        <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
          Keep more than one way back into the same account so losing access to a single inbox or
          provider does not strand the workspace.
        </p>
      </div>

      {props.errorMessage ? (
        <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          {props.errorMessage}
        </div>
      ) : null}
      {props.statusMessage ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
          {props.statusMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-base font-semibold">Password access</div>
          <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
            {props.hasPasswordAccount
              ? "A password is already attached to this identity. You can keep using email verification and magic-link recovery if needed."
              : "This account does not have a password yet. Add one so social-only access does not become a single point of failure."}
          </p>

          {props.hasPasswordAccount ? (
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
              Password access is active.
            </div>
          ) : (
            <form action={setPasswordAction} className="mt-5 space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-ink)]" htmlFor="newPassword">
                  New password
                </label>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
                  id="newPassword"
                  minLength={8}
                  name="newPassword"
                  required
                  type="password"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-ink)]" htmlFor="confirmPassword">
                  Confirm password
                </label>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
                  id="confirmPassword"
                  minLength={8}
                  name="confirmPassword"
                  required
                  type="password"
                />
              </div>
              <button
                className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)]"
                type="submit"
              >
                Add password sign-in
              </button>
            </form>
          )}
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-base font-semibold">Linked methods</div>
          <div className="mt-4 space-y-3 text-sm">
            {props.linkedAccounts.map((linkedAccount) => {
              const canUnlinkAccount = linkedAccount.providerId !== "credential";

              return (
                <div
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                  key={linkedAccount.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--color-ink)]">{linkedAccount.label}</div>
                      <div className="mt-1 text-[var(--color-muted)]">
                        Linked {formatTimestamp(linkedAccount.createdAt)}
                      </div>
                    </div>

                    {canUnlinkAccount ? (
                      <form action={unlinkAccountAction}>
                        <input name="accountId" type="hidden" value={linkedAccount.accountId} />
                        <input name="providerId" type="hidden" value={linkedAccount.providerId} />
                        <button
                          className="rounded-2xl border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-accent-strong)]"
                          type="submit"
                        >
                          Unlink
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-base font-semibold">Available social providers</div>
        <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
          Linking uses an explicit operator action. Existing identities are not auto-linked in the
          background.
        </p>

        <div className="mt-4 space-y-3">
          {props.availableSocialProviders.map((availableSocialProvider) => {
            const isUnavailable = !availableSocialProvider.isConfigured;

            return (
              <div
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                key={availableSocialProvider.providerId}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <div className="font-medium text-[var(--color-ink)]">
                      {availableSocialProvider.label}
                    </div>
                    <div className="mt-1 text-sm text-[var(--color-muted)]">
                      {availableSocialProvider.description}
                    </div>
                    {isUnavailable ? (
                      <div className="mt-2 text-xs text-[var(--color-muted)]">
                        Configure {availableSocialProvider.environmentVariableNames.join(" and ")} to
                        enable this provider.
                      </div>
                    ) : null}
                  </div>

                  {availableSocialProvider.isLinked ? (
                    <div className="rounded-2xl border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-muted)]">
                      Linked
                    </div>
                  ) : availableSocialProvider.isConfigured ? (
                    <form action={linkSocialAccountAction}>
                      <input
                        name="providerId"
                        type="hidden"
                        value={availableSocialProvider.providerId}
                      />
                      <button
                        className="rounded-2xl border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-accent-strong)]"
                        type="submit"
                      >
                        Link {availableSocialProvider.label}
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-2xl border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-muted)]">
                      Not configured
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {linkedSocialAccounts.length === 0 ? (
          <div className="mt-4 text-sm text-[var(--color-muted)]">
            No social providers are linked to this identity yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}