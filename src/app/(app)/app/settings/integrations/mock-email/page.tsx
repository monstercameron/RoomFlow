import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  getConfiguredEmailDeliveryProvider,
  getConfiguredEmailDeliveryProviderLabel,
  getConfiguredSenderEmailAddress,
} from "@/lib/email-delivery";
import {
  getMockEmailInboxFilePath,
  listMockEmailMessages,
} from "@/lib/mock-email-service";
import {
  clearMockEmailInboxAction,
  sendMockEmailProbeAction,
} from "@/app/(app)/app/settings/integrations/mock-email/actions";

const secondaryActionClassName =
  "inline-flex items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.96)] px-4 py-3 text-sm font-medium !text-[var(--color-ink)] visited:!text-[var(--color-ink)] hover:!text-[var(--color-ink)] focus-visible:!text-[var(--color-ink)] active:!text-[var(--color-ink)] shadow-[0_8px_18px_rgba(93,64,39,0.06)] transition-[border-color,background-color,color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.2)] hover:bg-[linear-gradient(180deg,rgba(255,247,239,1),rgba(244,233,221,1))] hover:shadow-[0_12px_24px_rgba(93,64,39,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]";

const primaryActionClassName =
  "inline-flex items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.24)] bg-[var(--color-accent)] px-4 py-3 text-sm font-medium !text-white visited:!text-white hover:!text-white focus-visible:!text-white active:!text-white shadow-[0_10px_24px_rgba(141,63,33,0.22)] transition-colors duration-150 hover:bg-[var(--color-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]";

function getStatusMessage(status?: string) {
  if (status === "sent") {
    return "Test email captured in the local mock inbox.";
  }

  if (status === "cleared") {
    return "Mock inbox cleared.";
  }

  return null;
}

export default async function MockEmailInboxPage(props: {
  searchParams: Promise<{
    error?: string;
    status?: string;
  }>;
}) {
  const searchParameters = await props.searchParams;
  const configuredProvider = getConfiguredEmailDeliveryProvider();
  const configuredProviderLabel = getConfiguredEmailDeliveryProviderLabel();
  const senderEmailAddress = getConfiguredSenderEmailAddress();
  const mockEmailMessages = await listMockEmailMessages();
  const statusMessage = getStatusMessage(searchParameters.status);

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Mock email inbox"
        description="Review the local email sink used for auth, invites, and outbound email while third-party delivery is not configured."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link className={secondaryActionClassName} href="/app/settings/integrations">
              Return to integrations
            </Link>
            <Link className={secondaryActionClassName} href="/app/settings/security">
              Open security settings
            </Link>
          </div>
        }
      />

      {searchParameters.error ? (
        <div className="mb-4 rounded-[2rem] border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] p-6 shadow-[var(--shadow-panel)] text-sm font-medium text-[var(--color-accent-strong)]">
          {searchParameters.error}
        </div>
      ) : null}
      {statusMessage ? (
        <div className="mb-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] text-sm font-medium text-[var(--color-ink)]">
          {statusMessage}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] md:p-7">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Active provider</div>
            <div className="mt-3 text-lg font-semibold text-[var(--color-ink)]">{configuredProviderLabel}</div>
          </div>
          <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Sender address</div>
            <div className="mt-3 break-all text-lg font-semibold text-[var(--color-ink)]">{senderEmailAddress}</div>
          </div>
          <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Storage path</div>
            <div className="mt-3 break-all text-sm font-medium text-[var(--color-ink)]">{getMockEmailInboxFilePath()}</div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] md:p-7">
          <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">Probe the sink</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Send a test email</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Use this to prove the local delivery path before wiring SES credentials. Auth emails, invites, and outbound lead email use the same mock transport when the provider is set to mock.
          </p>

          <form action={sendMockEmailProbeAction} className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-ink)]">Recipient email</span>
              <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]" defaultValue="test@roomflow.local" name="recipientEmailAddress" required type="email" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-ink)]">Subject</span>
              <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]" defaultValue="Roomflow mock delivery check" name="subject" required type="text" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-ink)]">Body</span>
              <textarea className="min-h-40 w-full rounded-[1.5rem] border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]" defaultValue="This local message proves the mock email sink is capturing outbound mail before SES is configured." name="text" required />
            </label>
            <button className={primaryActionClassName} type="submit">Capture test email</button>
          </form>

          <form action={clearMockEmailInboxAction} className="mt-4">
            <button className={secondaryActionClassName} type="submit">Clear mock inbox</button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">Captured messages</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Inbox preview</h2>
            </div>
            <div className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {mockEmailMessages.length} message{mockEmailMessages.length === 1 ? "" : "s"}
            </div>
          </div>

          {configuredProvider !== "mock" ? (
            <div className="mt-5 rounded-[1.5rem] border border-[rgba(184,88,51,0.24)] bg-[rgba(255,244,236,0.92)] p-5 text-sm leading-7 text-[var(--color-muted)]">
              The active provider is {configuredProviderLabel}. Switch <span className="font-medium text-[var(--color-ink)]">EMAIL_DELIVERY_PROVIDER</span> to <span className="font-medium text-[var(--color-ink)]">mock</span> to capture local messages here.
            </div>
          ) : mockEmailMessages.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5 text-sm leading-7 text-[var(--color-muted)]">
              No messages captured yet. Trigger forgot password, magic link, workspace invite, or use the test form on this page.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {mockEmailMessages.map((mockEmailMessage) => (
                <article key={mockEmailMessage.id} className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[var(--color-ink)]">{mockEmailMessage.subject}</div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">To: {mockEmailMessage.to.join(", ")}</div>
                      <div className="mt-1 text-sm text-[var(--color-muted)]">From: {mockEmailMessage.from}</div>
                    </div>
                    <div className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      {new Date(mockEmailMessage.sentAt).toLocaleString()}
                    </div>
                  </div>
                  <pre className="mt-4 whitespace-pre-wrap rounded-[1.25rem] border border-[var(--color-line)] bg-white px-4 py-4 text-sm leading-7 text-[var(--color-ink)]">{mockEmailMessage.text}</pre>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}