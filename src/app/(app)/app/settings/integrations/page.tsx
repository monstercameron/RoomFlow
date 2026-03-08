import { PageHeader } from "@/components/page-header";
import { updateWorkspaceQuietHoursAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateWorkspaceMessagingThrottleSettingsAction } from "@/app/(app)/app/settings/integrations/actions";
import { getMessagingSettingsViewData } from "@/lib/app-data";
import { validateInboundIntegrationConfiguration } from "@/lib/integration-config-validation";
import { onboardingChannelOptions } from "@/lib/onboarding";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3001";

export default async function IntegrationsSettingsPage() {
  const messagingSettings = await getMessagingSettingsViewData();
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
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">Workspace quiet hours</div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            Automated outbound messaging pauses during this window. Individual properties can inherit this default or override it.
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
            Current setting: {messagingSettings.workspaceQuietHoursSummary}
          </div>
          <form
            action={updateWorkspaceQuietHoursAction}
            className="mt-5 grid gap-3 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4 md:grid-cols-3"
          >
            <label className="flex items-center gap-2 md:col-span-3">
              <input
                defaultChecked={Boolean(messagingSettings.workspaceQuietHoursStartLocal)}
                name="quietHoursEnabled"
                type="checkbox"
              />
              <span className="text-sm font-medium">Enable workspace quiet hours</span>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Start</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.workspaceQuietHoursStartLocal ?? "21:00"}
                name="quietHoursStartLocal"
                type="time"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">End</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.workspaceQuietHoursEndLocal ?? "08:00"}
                name="quietHoursEndLocal"
                type="time"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Time zone</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.workspaceQuietHoursTimeZone ?? "America/New_York"}
                name="quietHoursTimeZone"
                placeholder="America/New_York"
                type="text"
              />
            </label>
            <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
            <div className="flex justify-end md:col-span-3">
              <button
                className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                type="submit"
              >
                Save quiet hours
              </button>
            </div>
          </form>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {messagingSettings.properties.map((property) => (
              <div
                key={property.id}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm"
              >
                <div className="font-medium">{property.name}</div>
                <div className="mt-2 text-[var(--color-muted)]">{property.quietHoursSummary}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">Automation throttles</div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            Control how often automated outreach can send and how quickly repeated missing-information prompts are allowed.
          </p>
          <form
            action={updateWorkspaceMessagingThrottleSettingsAction}
            className="mt-5 grid gap-3 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4 md:grid-cols-2"
          >
            <label className="space-y-2">
              <span className="text-sm font-medium">Daily automated send cap</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={String(messagingSettings.dailyAutomatedSendCap)}
                min={1}
                name="dailyAutomatedSendCap"
                type="number"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Missing-info throttle window (minutes)</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={String(messagingSettings.missingInfoPromptThrottleMinutes)}
                min={1}
                name="missingInfoPromptThrottleMinutes"
                type="number"
              />
            </label>
            <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
            <div className="flex justify-end md:col-span-2">
              <button
                className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                type="submit"
              >
                Save throttle settings
              </button>
            </div>
          </form>
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
