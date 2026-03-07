import { PageHeader } from "@/components/page-header";
import { validateInboundIntegrationConfiguration } from "@/lib/integration-config-validation";
import { onboardingChannelOptions } from "@/lib/onboarding";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3001";

export default function IntegrationsSettingsPage() {
  const directChannels = onboardingChannelOptions.filter(
    (channel) => channel.mode === "direct" && channel.type !== "MANUAL",
  );
  const sourceTags = onboardingChannelOptions.filter(
    (channel) => channel.mode === "source_tag",
  );
  const integrationValidationIssues = validateInboundIntegrationConfiguration({
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    inboundWebhookSigningSecret: process.env.INBOUND_WEBHOOK_SIGNING_SECRET,
  });

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Integrations"
        description="These are still v1 placeholders, but they now reflect the actual channel strategy in the README and todo list."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">Integration config validation</div>
          <div className="mt-4 space-y-3">
            {integrationValidationIssues.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
                All inbound email/SMS parsing and signing variables are configured.
              </div>
            ) : (
              integrationValidationIssues.map((issue) => (
                <div
                  key={issue.key}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm"
                >
                  <div className="font-medium">
                    {issue.key} ({issue.level})
                  </div>
                  <div className="mt-1 text-[var(--color-muted)]">{issue.detail}</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Inbound email</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Email webhook ingestion is now live. Provider-specific delivery and auth
            details still need real production credentials.
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
            Expected webhook base: {appUrl}/api/webhooks/email
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">SMS provider</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            SMS webhook ingestion is now live, and Twilio delivery plumbing is in
            the stack. Real credentials are still required before outbound SMS can send.
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
            Expected webhook base: {appUrl}/api/webhooks/sms
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Supported v1 channels</div>
          <div className="mt-4 space-y-3">
            {directChannels.map((channel) => (
              <div
                key={channel.key}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm"
              >
                <div className="font-medium">{channel.label}</div>
                <div className="mt-1 text-[var(--color-muted)]">
                  {channel.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Source-tag only marketplaces</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {sourceTags.map((channel) => (
              <div
                key={channel.key}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm"
              >
                <div className="font-medium">{channel.label}</div>
                <div className="mt-1 text-[var(--color-muted)]">
                  Stored as a lead source, not a live integration.
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Webhook endpoint display</div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
            {appUrl}/api/webhooks/*
          </div>
          <div className="mt-3 text-xs text-[var(--color-muted)]">
            Include `workspaceId` as a query param or in the posted payload for local
            webhook testing.
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">CSV import</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Placeholder only. Bulk lead import is deferred until the lead
            normalization layer is in place.
          </p>
        </div>
      </div>
    </main>
  );
}
