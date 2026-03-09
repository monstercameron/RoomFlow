import { PageHeader } from "@/components/page-header";
import { CalendarSyncProvider } from "@/generated/prisma/client";
import Link from "next/link";
import { updateWorkspaceQuietHoursAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateWorkspaceMessagingThrottleSettingsAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateOperatorSchedulingAvailabilityAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateWorkspaceCalendarConnectionAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateCsvImportIntegrationAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateInboundWebhookIntegrationAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateListingFeedIntegrationAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateMessagingChannelIntegrationAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateMetaLeadAdsIntegrationAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateOutboundWebhookIntegrationAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateS3IntegrationAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateSlackIntegrationAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateWorkspaceScreeningConnectionAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateWorkspaceTourSchedulingSettingsAction } from "@/app/(app)/app/settings/integrations/actions";
import { getMessagingSettingsViewData } from "@/lib/app-data";
import { availabilityDayOptions } from "@/lib/availability-windows";
import { validateInboundIntegrationConfiguration } from "@/lib/integration-config-validation";
import { csvExportDatasetDefinitions, outboundWebhookEventDefinitions } from "@/lib/integrations";
import { onboardingChannelOptions } from "@/lib/onboarding";
import {
  getConfiguredEmailDeliveryProvider,
  getConfiguredEmailDeliveryProviderLabel,
} from "@/lib/email-delivery";
import {
  screeningChargeModeOptions,
  screeningConnectionAuthStateOptions,
  screeningProviderOptions,
} from "@/lib/screening";
import { calendarConnectionStatusOptions, tourSchedulingModeOptions } from "@/lib/tour-scheduling";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3001";
const secondaryActionClassName =
  "inline-flex items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.96)] px-4 py-3 text-sm font-medium !text-[var(--color-ink)] visited:!text-[var(--color-ink)] hover:!text-[var(--color-ink)] focus-visible:!text-[var(--color-ink)] active:!text-[var(--color-ink)] shadow-[0_8px_18px_rgba(93,64,39,0.06)] transition-[border-color,background-color,color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.2)] hover:bg-[linear-gradient(180deg,rgba(255,247,239,1),rgba(244,233,221,1))] hover:shadow-[0_12px_24px_rgba(93,64,39,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]";

export default async function IntegrationsSettingsPage() {
  const messagingSettings = await getMessagingSettingsViewData();
  const emailDeliveryProvider = getConfiguredEmailDeliveryProvider();
  const emailDeliveryProviderLabel = getConfiguredEmailDeliveryProviderLabel();
  const directChannels = onboardingChannelOptions.filter(
    (channel) => channel.mode === "direct" && channel.type !== "MANUAL",
  );
  const sourceTags = onboardingChannelOptions.filter(
    (channel) => channel.mode === "source_tag",
  );
  const integrationValidationIssues = validateInboundIntegrationConfiguration({
    emailDeliveryProvider: process.env.EMAIL_DELIVERY_PROVIDER,
    emailFromAddress: process.env.EMAIL_FROM_ADDRESS,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    microsoftClientId: process.env.MICROSOFT_CLIENT_ID,
    microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
    awsRegion: process.env.AWS_REGION,
    awsDefaultRegion: process.env.AWS_DEFAULT_REGION,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sesFromEmail: process.env.SES_FROM_EMAIL,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    inboundWebhookSigningSecret: process.env.INBOUND_WEBHOOK_SIGNING_SECRET,
  });
  const screeningConnectionsByProvider = new Map(
    messagingSettings.screeningConnections.map((screeningConnection) => [
      screeningConnection.provider,
      screeningConnection,
    ]),
  );

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Integrations"
        description="Use the integrations hub to track setup state, health, and mapping for inbound, outbound, calendar, and screening connections."
        actions={
          emailDeliveryProvider === "mock" ? (
            <Link className={secondaryActionClassName} href="/app/settings/integrations/mock-email">
              Open mock email inbox
            </Link>
          ) : null
        }
      />

      <div className="mb-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-[var(--shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Outbound email mode</div>
            <div className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{emailDeliveryProviderLabel}</div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
              {emailDeliveryProvider === "mock"
                ? "Local mock delivery is active, so auth emails, invites, and outbound email are captured inside the workspace for testing."
                : "Switch to the mock provider when you want a local inbox before real provider credentials are available."}
            </p>
          </div>
          {emailDeliveryProvider === "mock" ? (
            <Link className={secondaryActionClassName} href="/app/settings/integrations/mock-email">
              Review captured email
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xl font-semibold">Integrations hub</div>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
                Track setup progress, health state, and recent sync posture across the providers Roomflow depends on.
              </p>
            </div>
            <div className="grid min-w-[18rem] gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Connected</div>
                <div className="mt-2 text-2xl font-semibold">{messagingSettings.integrationHealthOverview.connected}</div>
              </div>
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Degraded</div>
                <div className="mt-2 text-2xl font-semibold">{messagingSettings.integrationHealthOverview.degraded}</div>
              </div>
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Errors</div>
                <div className="mt-2 text-2xl font-semibold">{messagingSettings.integrationHealthOverview.errors}</div>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {messagingSettings.integrationHubConnections.map((integrationConnection) => (
              <div
                key={integrationConnection.id}
                className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{integrationConnection.label}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      {integrationConnection.category}
                    </div>
                  </div>
                  <div className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-muted)]">
                    {integrationConnection.healthState}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                  {integrationConnection.description}
                </p>
                <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-muted)]">
                  <div className="font-medium text-[color:var(--color-ink)]">{integrationConnection.summary}</div>
                  <div className="mt-2">Auth: {integrationConnection.authState}</div>
                  <div className="mt-2">Sync: {integrationConnection.syncStatus}</div>
                  <div className="mt-2">Last sync: {integrationConnection.lastSyncAt}</div>
                  {integrationConnection.latestSyncSummary ? (
                    <div className="mt-2">Latest event: {integrationConnection.latestSyncSummary}</div>
                  ) : null}
                  {integrationConnection.healthMessage ? (
                    <div className="mt-2">Health note: {integrationConnection.healthMessage}</div>
                  ) : null}
                </div>
                <div className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Setup step {integrationConnection.currentSetupStep} of {integrationConnection.totalSetupSteps}: {integrationConnection.currentSetupLabel}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">Integration config validation</div>
          <div className="mt-4 space-y-3">
            {integrationValidationIssues.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
                All current inbound, outbound, and signing variables are configured.
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
        <form
          action={updateInboundWebhookIntegrationAction}
          className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2"
        >
          <div className="text-xl font-semibold">Generic inbound webhook</div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            Save default lead mapping, signature header expectations, and field routing for generic inbound webhook ingestion.
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input
              defaultChecked={messagingSettings.inboundWebhookIntegration.webhookEnabled}
              name="webhookEnabled"
              type="checkbox"
            />
            <span className="text-sm font-medium">Enable generic inbound webhook ingestion</span>
          </label>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium">Source label</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.inboundWebhookIntegration.sourceLabel}
                name="sourceLabel"
                placeholder="Generic webhook source"
                type="text"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Signature header</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.inboundWebhookIntegration.signingHeader}
                name="signingHeader"
                placeholder="x-roomflow-signature"
                type="text"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Secret hint</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.inboundWebhookIntegration.secretHint ?? ""}
                name="secretHint"
                placeholder="Stored in provider vault"
                type="text"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Default lead source</span>
              <select
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.inboundWebhookIntegration.defaultLeadSourceId ?? ""}
                name="defaultLeadSourceId"
              >
                <option value="">Create or route without a saved lead source</option>
                {messagingSettings.leadSources.map((leadSource) => (
                  <option key={leadSource.id} value={leadSource.id}>
                    {leadSource.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Fallback source type</span>
              <select
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.inboundWebhookIntegration.defaultLeadSourceType}
                name="defaultLeadSourceType"
              >
                <option value="WEB_FORM">Web form</option>
                <option value="CSV_IMPORT">CSV import</option>
                <option value="FACEBOOK">Facebook / Meta</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Default message channel</span>
              <select
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.inboundWebhookIntegration.defaultMessageChannel}
                name="defaultMessageChannel"
              >
                {directChannels.map((channel) => (
                  <option key={channel.type} value={channel.type}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-6 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm font-medium">Field mapping preview</div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Store the most important source-to-target mappings now; provider adapters can expand on these later.
            </p>
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((mappingIndex) => {
                const existingMapping =
                  messagingSettings.inboundWebhookIntegration.fieldMappings[mappingIndex - 1];

                return (
                  <div key={mappingIndex} className="grid gap-3 md:grid-cols-[1.1fr_1.1fr_auto]">
                    <input
                      className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue={existingMapping?.sourceField ?? ""}
                      name={`fieldMapping${mappingIndex}Source`}
                      placeholder="payload.email"
                      type="text"
                    />
                    <input
                      className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue={existingMapping?.targetField ?? ""}
                      name={`fieldMapping${mappingIndex}Target`}
                      placeholder="email"
                      type="text"
                    />
                    <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm">
                      <input
                        defaultChecked={existingMapping?.required ?? false}
                        name={`fieldMapping${mappingIndex}Required`}
                        type="checkbox"
                      />
                      Required
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
              type="submit"
            >
              Save inbound webhook config
            </button>
          </div>
        </form>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">Screening provider connections</div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            Configure screening providers, default packages, and pass-through billing mode. Screening remains provider-hosted; Roomflow stores launch state, consent milestones, and report references.
          </p>
          {!messagingSettings.canUseScreening ? (
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
              Screening connections require the Org package with the screening capability enabled.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              {screeningProviderOptions.map((providerOption) => {
                const connection = screeningConnectionsByProvider.get(providerOption.value);

                return (
                  <form
                    action={updateWorkspaceScreeningConnectionAction}
                    className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                    key={providerOption.value}
                  >
                    <div className="text-sm font-medium">{providerOption.label}</div>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      Current state: {connection?.summary ?? "Not connected"}
                    </div>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Auth state</span>
                      <select
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={connection?.authState ?? "DISCONNECTED"}
                        name="authState"
                      >
                        {screeningConnectionAuthStateOptions.map((authStateOption) => (
                          <option key={authStateOption.value} value={authStateOption.value}>
                            {authStateOption.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Connected account</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={connection?.connectedAccount ?? ""}
                        name="connectedAccount"
                        placeholder="screening@roomflow.app"
                        type="text"
                      />
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Default package key</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={connection?.defaultPackageKey ?? ""}
                        name="defaultPackageKey"
                        placeholder="standard"
                        type="text"
                      />
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Default package label</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={connection?.defaultPackageLabel ?? ""}
                        name="defaultPackageLabel"
                        placeholder="Standard screening"
                        type="text"
                      />
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Secondary package key</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={connection?.packageOptions[1]?.key ?? ""}
                        name="secondaryPackageKey"
                        placeholder="premium"
                        type="text"
                      />
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Secondary package label</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={connection?.packageOptions[1]?.label ?? ""}
                        name="secondaryPackageLabel"
                        placeholder="Premium screening"
                        type="text"
                      />
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Charge mode</span>
                      <select
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={connection?.chargeMode ?? "PASS_THROUGH"}
                        name="chargeMode"
                      >
                        {screeningChargeModeOptions.map((chargeModeOption) => (
                          <option key={chargeModeOption.value} value={chargeModeOption.value}>
                            {chargeModeOption.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Disclosure strategy</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={connection?.disclosureStrategy ?? ""}
                        name="disclosureStrategy"
                        placeholder="Provider-hosted disclosure + consent"
                        type="text"
                      />
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Error note</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={connection?.lastError ?? ""}
                        name="lastError"
                        placeholder="Credentials expired or provider approval pending."
                        type="text"
                      />
                    </label>
                    <input name="provider" type="hidden" value={providerOption.value} />
                    <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
                    <div className="mt-4 flex justify-end">
                      <button
                        className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                        type="submit"
                      >
                        Save {providerOption.label}
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">Calendar sync connections</div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            Store the workspace connection state for Google Calendar and Outlook. Scheduled, rescheduled, canceled, and no-show tour updates will sync only when the selected provider is active.
          </p>
          {!messagingSettings.canUseCalendarSync ? (
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
              Calendar sync requires the Org package with the calendar sync capability enabled.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <form
                action={updateWorkspaceCalendarConnectionAction}
                className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              >
                <div className="text-sm font-medium">Google Calendar</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Current state: {messagingSettings.googleCalendarConnectionSummary}
                </div>
                <label className="mt-4 flex items-center gap-2">
                  <input
                    defaultChecked={messagingSettings.googleCalendarConnectionSyncEnabled}
                    name="syncEnabled"
                    type="checkbox"
                  />
                  <span className="text-sm font-medium">Enable Google sync</span>
                </label>
                <label className="mt-3 block space-y-2">
                  <span className="text-sm font-medium">Connected account</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={messagingSettings.googleCalendarConnectedAccount}
                    name="connectedAccount"
                    placeholder="ops@roomflow.app"
                    type="text"
                  />
                </label>
                <label className="mt-3 block space-y-2">
                  <span className="text-sm font-medium">Connection status</span>
                  <select
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={messagingSettings.googleCalendarConnectionStatus}
                    name="status"
                  >
                    {calendarConnectionStatusOptions.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block space-y-2">
                  <span className="text-sm font-medium">Error note</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={messagingSettings.googleCalendarConnectionError ?? ""}
                    name="errorMessage"
                    placeholder="Refresh token expired, calendar API disabled, or target unavailable."
                    type="text"
                  />
                </label>
                <input name="provider" type="hidden" value={CalendarSyncProvider.GOOGLE} />
                <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
                <div className="mt-4 flex justify-end">
                  <button
                    className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                    type="submit"
                  >
                    Save Google sync
                  </button>
                </div>
              </form>
              <form
                action={updateWorkspaceCalendarConnectionAction}
                className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              >
                <div className="text-sm font-medium">Outlook Calendar</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Current state: {messagingSettings.outlookCalendarConnectionSummary}
                </div>
                <label className="mt-4 flex items-center gap-2">
                  <input
                    defaultChecked={messagingSettings.outlookCalendarConnectionSyncEnabled}
                    name="syncEnabled"
                    type="checkbox"
                  />
                  <span className="text-sm font-medium">Enable Outlook sync</span>
                </label>
                <label className="mt-3 block space-y-2">
                  <span className="text-sm font-medium">Connected account</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={messagingSettings.outlookCalendarConnectedAccount}
                    name="connectedAccount"
                    placeholder="leasing@roomflow.app"
                    type="text"
                  />
                </label>
                <label className="mt-3 block space-y-2">
                  <span className="text-sm font-medium">Connection status</span>
                  <select
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={messagingSettings.outlookCalendarConnectionStatus}
                    name="status"
                  >
                    {calendarConnectionStatusOptions.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block space-y-2">
                  <span className="text-sm font-medium">Error note</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={messagingSettings.outlookCalendarConnectionError ?? ""}
                    name="errorMessage"
                    placeholder="Consent missing, mailbox unavailable, or target inaccessible."
                    type="text"
                  />
                </label>
                <input name="provider" type="hidden" value={CalendarSyncProvider.OUTLOOK} />
                <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
                <div className="mt-4 flex justify-end">
                  <button
                    className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                    type="submit"
                  >
                    Save Outlook sync
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">Operator tour availability</div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            Manual tour scheduling uses this recurring window for the current operator. Leave it disabled if tours can be booked at any time.
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
            Current setting: {messagingSettings.operatorSchedulingAvailabilitySummary}
          </div>
          <form
            action={updateOperatorSchedulingAvailabilityAction}
            className="mt-5 grid gap-3 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4 md:grid-cols-3"
          >
            <label className="flex items-center gap-2 md:col-span-3">
              <input
                defaultChecked={Boolean(messagingSettings.operatorSchedulingAvailabilityStartLocal)}
                name="availabilityEnabled"
                type="checkbox"
              />
              <span className="text-sm font-medium">Enable operator availability</span>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Start</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.operatorSchedulingAvailabilityStartLocal ?? "09:00"}
                name="availabilityStartLocal"
                type="time"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">End</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.operatorSchedulingAvailabilityEndLocal ?? "17:00"}
                name="availabilityEndLocal"
                type="time"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Time zone</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.operatorSchedulingAvailabilityTimeZone ?? "America/New_York"}
                name="availabilityTimeZone"
                placeholder="America/New_York"
                type="text"
              />
            </label>
            <div className="md:col-span-3">
              <div className="text-sm font-medium">Days</div>
              <div className="mt-3 flex flex-wrap gap-3">
                {availabilityDayOptions.map((dayOption) => (
                  <label
                    key={dayOption.value}
                    className="flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
                  >
                    <input
                      defaultChecked={messagingSettings.operatorSchedulingAvailabilityDays.includes(
                        dayOption.value,
                      )}
                      name="availabilityDays"
                      type="checkbox"
                      value={dayOption.value}
                    />
                    <span>{dayOption.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
            <div className="flex justify-end md:col-span-3">
              <button
                className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                type="submit"
              >
                Save operator availability
              </button>
            </div>
          </form>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {messagingSettings.properties.map((property) => (
              <div
                key={`${property.id}-availability`}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm"
              >
                <div className="font-medium">{property.name}</div>
                <div className="mt-2 text-[var(--color-muted)]">
                  {property.schedulingAvailabilitySummary}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">Tour assignment and reminders</div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            Control whether tours stay with the current operator, use manual teammate assignment, or rotate across the shared-coverage pool. Reminder offsets are tied to every scheduled tour.
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
            Scheduling mode: {messagingSettings.tourSchedulingModeSummary} · Reminder sequence: {messagingSettings.tourReminderSequenceSummary}
          </div>
          <form
            action={updateWorkspaceTourSchedulingSettingsAction}
            className="mt-5 grid gap-3 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4 md:grid-cols-3"
          >
            <label className="space-y-2 md:col-span-3">
              <span className="text-sm font-medium">Assignment mode</span>
              <select
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.tourSchedulingMode}
                name="tourSchedulingMode"
              >
                {tourSchedulingModeOptions.map((modeOption) => (
                  <option
                    disabled={
                      !messagingSettings.canUseTeamScheduling &&
                      modeOption.value !== "DIRECT"
                    }
                    key={modeOption.value}
                    value={modeOption.value}
                  >
                    {modeOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">First reminder (minutes before)</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={String(messagingSettings.tourReminderSequence[0]?.minutesBefore ?? 1440)}
                min={1}
                name="firstReminderMinutes"
                type="number"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Second reminder (minutes before)</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={String(messagingSettings.tourReminderSequence[1]?.minutesBefore ?? 60)}
                min={1}
                name="secondReminderMinutes"
                type="number"
              />
            </label>
            <div className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-muted)]">
              {messagingSettings.canUseTeamScheduling
                ? "Shared-coverage member participation is managed on the members page."
                : "Upgrade to an Org workspace to unlock teammate assignment and round-robin coverage."}
            </div>
            <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
            <div className="flex justify-end md:col-span-3">
              <button
                className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                type="submit"
              >
                Save scheduling settings
              </button>
            </div>
          </form>
          {messagingSettings.sharedCoverageMemberships.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {messagingSettings.sharedCoverageMemberships.map((member) => (
                <div
                  key={`${member.id}-coverage`}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm"
                >
                  <div className="font-medium">{member.name}</div>
                  <div className="mt-2 text-[var(--color-muted)]">
                    Coverage: {member.sharedTourCoverageEnabled ? "Shared pool" : "Direct only"}
                  </div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Availability: {member.schedulingAvailabilitySummary}
                  </div>
                  <div className="mt-1 text-[var(--color-muted)]">
                    Last assignment: {member.lastTourAssignedAt}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
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

        <form
          action={updateMetaLeadAdsIntegrationAction}
          className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2"
        >
          <div className="text-xl font-semibold">Meta Lead Ads</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Ingest paid acquisition leads from Facebook and Instagram campaigns through a dedicated Meta webhook adapter.
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input
              defaultChecked={messagingSettings.metaLeadAdsIntegration.webhookEnabled}
              name="webhookEnabled"
              type="checkbox"
            />
            <span className="text-sm font-medium">Enable Meta Lead Ads ingestion</span>
          </label>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium">Source label</span>
              <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.metaLeadAdsIntegration.sourceLabel} name="sourceLabel" placeholder="Meta Lead Ads" type="text" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Meta page ID</span>
              <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.metaLeadAdsIntegration.pageId ?? ""} name="pageId" placeholder="123456789" type="text" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Lead form ID</span>
              <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.metaLeadAdsIntegration.formId ?? ""} name="formId" placeholder="987654321" type="text" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Verify token</span>
              <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.metaLeadAdsIntegration.verifyToken ?? ""} name="verifyToken" placeholder="meta-verify-token" type="text" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">App secret</span>
              <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.metaLeadAdsIntegration.appSecret ?? ""} name="appSecret" placeholder="Used for x-hub-signature-256 validation" type="text" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Campaign tag</span>
              <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.metaLeadAdsIntegration.campaignTag ?? ""} name="campaignTag" placeholder="spring-move-in" type="text" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Default lead source</span>
              <select className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.metaLeadAdsIntegration.defaultLeadSourceId ?? ""} name="defaultLeadSourceId">
                <option value="">Use source label only</option>
                {messagingSettings.leadSources.map((leadSource) => (
                  <option key={leadSource.id} value={leadSource.id}>{leadSource.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-6 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm font-medium">Lead form mapping</div>
            <div className="mt-4 space-y-3">
              {[
                { target: "fullName", placeholder: "full_name" },
                { target: "email", placeholder: "email" },
                { target: "phone", placeholder: "phone_number" },
                { target: "notes", placeholder: "move_in_timeline" },
              ].map((mappingDefinition, index) => {
                const existingMapping = messagingSettings.metaLeadAdsIntegration.fieldMappings.find((fieldMapping) => fieldMapping.targetField === mappingDefinition.target);
                return (
                  <div key={mappingDefinition.target} className="grid gap-3 md:grid-cols-[1.1fr_auto_1.1fr]">
                    <input className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={existingMapping?.sourceField ?? mappingDefinition.placeholder} name={`fieldMapping${index + 1}Source`} placeholder={mappingDefinition.placeholder} type="text" />
                    <input name={`fieldMapping${index + 1}Target`} type="hidden" value={mappingDefinition.target} />
                    <div className="flex items-center rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-muted)]">{mappingDefinition.target}</div>
                    <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm">
                      <input defaultChecked={existingMapping?.required ?? mappingDefinition.target === "fullName"} name={`fieldMapping${index + 1}Required`} type="checkbox" />
                      Required
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
            {messagingSettings.metaLeadAdsIntegration.summary}
            <div className="mt-2">Webhook base: {appUrl}/api/webhooks/meta/lead-ads?workspaceId=YOUR_WORKSPACE_ID</div>
          </div>
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-5 flex justify-end">
            <button className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white" type="submit">Save Meta Lead Ads config</button>
          </div>
        </form>

        <form action={updateMessagingChannelIntegrationAction} className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">WhatsApp business messaging</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            {messagingSettings.hasWhatsAppMessagingCapability
              ? "Configure Twilio-backed WhatsApp inbound sync and outbound sender identity for prospect conversations."
              : "WhatsApp messaging is reserved for Org workspaces and stays hidden from Personal plans."}
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input defaultChecked={messagingSettings.whatsappIntegration.webhookEnabled && messagingSettings.hasWhatsAppMessagingCapability} disabled={!messagingSettings.hasWhatsAppMessagingCapability} name="webhookEnabled" type="checkbox" />
            <span className="text-sm font-medium">Enable WhatsApp provider</span>
          </label>
          <div className="mt-4 grid gap-4">
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.whatsappIntegration.accountLabel} disabled={!messagingSettings.hasWhatsAppMessagingCapability} name="accountLabel" placeholder="Twilio WhatsApp sender" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.whatsappIntegration.senderIdentifier ?? ""} disabled={!messagingSettings.hasWhatsAppMessagingCapability} name="senderIdentifier" placeholder="+15551234567" type="text" />
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.whatsappIntegration.allowInboundSync} disabled={!messagingSettings.hasWhatsAppMessagingCapability} name="allowInboundSync" type="checkbox" />Inbound sync</label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.whatsappIntegration.allowOutboundSend} disabled={!messagingSettings.hasWhatsAppMessagingCapability} name="allowOutboundSend" type="checkbox" />Outbound delivery</label>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">{messagingSettings.whatsappIntegration.summary}<div className="mt-2">Webhook base: {appUrl}/api/webhooks/whatsapp</div></div>
          <input name="provider" type="hidden" value="WHATSAPP" />
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-4 flex justify-end"><button className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white" disabled={!messagingSettings.hasWhatsAppMessagingCapability} type="submit">Save WhatsApp config</button></div>
        </form>

        <form action={updateMessagingChannelIntegrationAction} className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Instagram business messaging</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            {messagingSettings.hasInstagramMessagingCapability
              ? "Configure Meta business inbox sync for Instagram conversations and lead-thread association."
              : "Instagram messaging is reserved for Org workspaces and stays hidden from Personal plans."}
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input defaultChecked={messagingSettings.instagramIntegration.webhookEnabled && messagingSettings.hasInstagramMessagingCapability} disabled={!messagingSettings.hasInstagramMessagingCapability} name="webhookEnabled" type="checkbox" />
            <span className="text-sm font-medium">Enable Instagram provider</span>
          </label>
          <div className="mt-4 grid gap-4">
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.instagramIntegration.accountLabel} disabled={!messagingSettings.hasInstagramMessagingCapability} name="accountLabel" placeholder="Meta business inbox" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.instagramIntegration.senderIdentifier ?? ""} disabled={!messagingSettings.hasInstagramMessagingCapability} name="senderIdentifier" placeholder="instagram_business_account_id" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.instagramIntegration.verifyToken ?? ""} disabled={!messagingSettings.hasInstagramMessagingCapability} name="verifyToken" placeholder="meta-instagram-verify-token" type="text" />
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.instagramIntegration.allowInboundSync} disabled={!messagingSettings.hasInstagramMessagingCapability} name="allowInboundSync" type="checkbox" />Inbound sync</label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.instagramIntegration.allowOutboundSend} disabled={!messagingSettings.hasInstagramMessagingCapability} name="allowOutboundSend" type="checkbox" />Stage outbound sends</label>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">{messagingSettings.instagramIntegration.summary}<div className="mt-2">Webhook base: {appUrl}/api/webhooks/meta/instagram</div></div>
          <input name="provider" type="hidden" value="INSTAGRAM" />
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-4 flex justify-end"><button className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white" disabled={!messagingSettings.hasInstagramMessagingCapability} type="submit">Save Instagram config</button></div>
        </form>

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

        <form action={updateListingFeedIntegrationAction} className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Zillow listing feed</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">Publish active property metadata as a provider-shaped listing feed export path for Zillow onboarding and sync reviews.</p>
          <label className="mt-4 flex items-center gap-2"><input defaultChecked={messagingSettings.zillowListingFeedIntegration.webhookEnabled} name="feedEnabled" type="checkbox" /><span className="text-sm font-medium">Enable Zillow feed</span></label>
          <div className="mt-4 grid gap-4">
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.zillowListingFeedIntegration.feedLabel} name="feedLabel" placeholder="Zillow syndication" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.zillowListingFeedIntegration.destinationName ?? ""} name="destinationName" placeholder="Zillow Rentals" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.zillowListingFeedIntegration.destinationPath ?? ""} name="destinationPath" placeholder="https://partner.example.com/zillow-feed" type="url" />
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.zillowListingFeedIntegration.includeOnlyActiveProperties} name="includeOnlyActiveProperties" type="checkbox" />Only active properties</label>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">{messagingSettings.zillowListingFeedIntegration.summary}<div className="mt-2">{messagingSettings.zillowListingFeedIntegration.propertyCount} properties available · <a className="underline" href="/api/integrations/listing-feed?provider=zillow">Download feed</a></div></div>
          <input name="provider" type="hidden" value="ZILLOW" />
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-4 flex justify-end"><button className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white" type="submit">Save Zillow feed</button></div>
        </form>

        <form action={updateListingFeedIntegrationAction} className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Apartments.com feed</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">Maintain a provider feed path for Apartments.com listing updates, availability reviews, and partner setup handoff.</p>
          <label className="mt-4 flex items-center gap-2"><input defaultChecked={messagingSettings.apartmentsListingFeedIntegration.webhookEnabled} name="feedEnabled" type="checkbox" /><span className="text-sm font-medium">Enable Apartments.com feed</span></label>
          <div className="mt-4 grid gap-4">
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.apartmentsListingFeedIntegration.feedLabel} name="feedLabel" placeholder="Apartments.com syndication" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.apartmentsListingFeedIntegration.destinationName ?? ""} name="destinationName" placeholder="Apartments.com" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.apartmentsListingFeedIntegration.destinationPath ?? ""} name="destinationPath" placeholder="https://partner.example.com/apartments-feed" type="url" />
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.apartmentsListingFeedIntegration.includeOnlyActiveProperties} name="includeOnlyActiveProperties" type="checkbox" />Only active properties</label>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">{messagingSettings.apartmentsListingFeedIntegration.summary}<div className="mt-2">{messagingSettings.apartmentsListingFeedIntegration.propertyCount} properties available · <a className="underline" href="/api/integrations/listing-feed?provider=apartments-com">Download feed</a></div></div>
          <input name="provider" type="hidden" value="APARTMENTS_COM" />
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-4 flex justify-end"><button className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white" type="submit">Save Apartments.com feed</button></div>
        </form>

        <form action={updateSlackIntegrationAction} className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">Slack notifications</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">Forward high-signal workspace notifications into Slack channels using incoming webhooks.</p>
          <label className="mt-4 flex items-center gap-2"><input defaultChecked={messagingSettings.slackIntegration.webhookEnabled} name="webhookEnabled" type="checkbox" /><span className="text-sm font-medium">Enable Slack notifications</span></label>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.slackIntegration.webhookUrl ?? ""} name="webhookUrl" placeholder="https://hooks.slack.com/services/..." type="url" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.slackIntegration.channelLabel ?? ""} name="channelLabel" placeholder="#leasing-alerts" type="text" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.slackIntegration.notifyOnNewLead} name="notifyOnNewLead" type="checkbox" />New leads</label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.slackIntegration.notifyOnTourScheduled} name="notifyOnTourScheduled" type="checkbox" />Tour scheduled</label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.slackIntegration.notifyOnReviewAlerts} name="notifyOnReviewAlerts" type="checkbox" />Review alerts</label>
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"><input defaultChecked={messagingSettings.slackIntegration.notifyOnApplicationInviteStale} name="notifyOnApplicationInviteStale" type="checkbox" />Application stale</label>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">{messagingSettings.slackIntegration.summary}</div>
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-5 flex justify-end"><button className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white" type="submit">Save Slack config</button></div>
        </form>

        <form action={updateS3IntegrationAction} className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2">
          <div className="text-xl font-semibold">S3-compatible storage</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">Stage future attachment and export storage with bucket mapping, base paths, and endpoint configuration.</p>
          <label className="mt-4 flex items-center gap-2"><input defaultChecked={messagingSettings.s3Integration.webhookEnabled} name="storageEnabled" type="checkbox" /><span className="text-sm font-medium">Enable S3-compatible storage</span></label>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.s3Integration.endpointUrl ?? ""} name="endpointUrl" placeholder="https://s3.us-east-1.amazonaws.com" type="url" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.s3Integration.region ?? ""} name="region" placeholder="us-east-1" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.s3Integration.bucket ?? ""} name="bucket" placeholder="roomflow-assets" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.s3Integration.basePath} name="basePath" placeholder="roomflow" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.s3Integration.accessKeyIdHint ?? ""} name="accessKeyIdHint" placeholder="AKIA... stored in vault" type="text" />
            <input className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none" defaultValue={messagingSettings.s3Integration.secretAccessKeyHint ?? ""} name="secretAccessKeyHint" placeholder="Secret key stored in vault" type="text" />
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
            {messagingSettings.s3Integration.summary}
            <div className="mt-2">Preview paths: {messagingSettings.s3Integration.manifestPreview.join(" | ")}</div>
            <div className="mt-2"><a className="underline" href="/api/integrations/storage/manifest">View manifest</a></div>
          </div>
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-5 flex justify-end"><button className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white" type="submit">Save storage config</button></div>
        </form>

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

        <form
          action={updateOutboundWebhookIntegrationAction}
          className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2"
        >
          <div className="text-xl font-semibold">Outbound automation webhooks</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Route lead and workflow events into Zapier, Make, n8n, or custom automation endpoints from the integrations hub.
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input
              defaultChecked={messagingSettings.outboundWebhookIntegration.webhookEnabled}
              name="automationEnabled"
              type="checkbox"
            />
            <span className="text-sm font-medium">Enable outbound automation deliveries</span>
          </label>
          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium">Signing secret hint</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={messagingSettings.outboundWebhookIntegration.secretHint ?? ""}
              name="secretHint"
              placeholder="Workspace signing secret stored in vault"
              type="text"
            />
          </label>
          <div className="mt-6 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm font-medium">Destinations</div>
            <div className="mt-4 space-y-4">
              {[1, 2].map((destinationIndex) => {
                const destination =
                  messagingSettings.outboundWebhookIntegration.destinations[destinationIndex - 1];

                return (
                  <div key={destinationIndex} className="grid gap-3 md:grid-cols-[auto_1fr_1.4fr]">
                    <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm">
                      <input
                        defaultChecked={destination?.enabled ?? destinationIndex === 1}
                        name={`destination${destinationIndex}Enabled`}
                        type="checkbox"
                      />
                      Enabled
                    </label>
                    <input
                      className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue={destination?.label ?? ""}
                      name={`destination${destinationIndex}Label`}
                      placeholder={destinationIndex === 1 ? "Zapier" : "Make or n8n"}
                      type="text"
                    />
                    <input
                      className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue={destination?.url ?? ""}
                      name={`destination${destinationIndex}Url`}
                      placeholder="https://hooks.example.com/roomflow"
                      type="url"
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm font-medium">Event subscriptions</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {outboundWebhookEventDefinitions.map((eventDefinition) => (
                <label
                  className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"
                  key={eventDefinition.value}
                >
                  <div className="flex items-center gap-2">
                    <input
                      defaultChecked={messagingSettings.outboundWebhookIntegration.eventTypes.includes(eventDefinition.value)}
                      name={`eventType:${eventDefinition.value}`}
                      type="checkbox"
                      value={eventDefinition.value}
                    />
                    <span className="font-medium">{eventDefinition.label}</span>
                  </div>
                  <div className="mt-2 text-[var(--color-muted)]">{eventDefinition.description}</div>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
            {messagingSettings.outboundWebhookIntegration.summary}
            <div className="mt-2">
              {messagingSettings.outboundWebhookIntegration.pendingDeliveryCount} pending · {messagingSettings.outboundWebhookIntegration.failedDeliveryCount} failed
            </div>
          </div>
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
              type="submit"
            >
              Save outbound automation webhooks
            </button>
          </div>
        </form>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">CSV exports</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Download current workspace data as CSV for offline review, migrations, or downstream automation.
          </p>
          <div className="mt-5 space-y-3">
            {csvExportDatasetDefinitions.map((dataset) => (
              <div
                className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                key={dataset.value}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{dataset.label}</div>
                    <div className="mt-1 text-sm text-[var(--color-muted)]">{dataset.description}</div>
                  </div>
                  <a
                    className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                    href={`/api/integrations/csv-export?dataset=${dataset.value}`}
                  >
                    Download CSV
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          action={updateCsvImportIntegrationAction}
          className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] lg:col-span-2"
          id="csv-import"
        >
          <div className="text-xl font-semibold">CSV import</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Save a field-mapping profile and validate sample rows through the normalization layer before importing anything.
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input
              defaultChecked={messagingSettings.csvImportIntegration.webhookEnabled}
              name="importEnabled"
              type="checkbox"
            />
            <span className="text-sm font-medium">Enable CSV import profile</span>
          </label>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Source label</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.csvImportIntegration.sourceLabel}
                name="sourceLabel"
                placeholder="CSV import"
                type="text"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Default lead source</span>
              <select
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={messagingSettings.csvImportIntegration.defaultLeadSourceId ?? ""}
                name="defaultLeadSourceId"
              >
                <option value="">Use source label only</option>
                {messagingSettings.leadSources.map((leadSource) => (
                  <option key={leadSource.id} value={leadSource.id}>
                    {leadSource.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-6 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm font-medium">CSV field mapping</div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Map CSV headers to Roomflow fields. The preview uses the first five data rows.
            </p>
            <div className="mt-4 space-y-3">
              {[
                { target: "fullName", required: true, placeholder: "full_name" },
                { target: "email", required: false, placeholder: "email_address" },
                { target: "phone", required: false, placeholder: "phone" },
                { target: "notes", required: false, placeholder: "notes" },
              ].map((mappingDefinition, index) => {
                const existingMapping = messagingSettings.csvImportIntegration.fieldMappings.find(
                  (fieldMapping) => fieldMapping.targetField === mappingDefinition.target,
                );

                return (
                <div key={mappingDefinition.target} className="grid gap-3 md:grid-cols-[1.1fr_auto_1.1fr]">
                  <input
                    className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={existingMapping?.sourceField ?? mappingDefinition.placeholder}
                    name={`fieldMapping${index + 1}Source`}
                    placeholder={mappingDefinition.placeholder}
                    type="text"
                  />
                  <input
                    name={`fieldMapping${index + 1}Target`}
                    type="hidden"
                    value={mappingDefinition.target}
                  />
                  <div className="flex items-center rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-muted)]">
                    {mappingDefinition.target}
                  </div>
                  <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm">
                    <input
                      defaultChecked={existingMapping?.required ?? mappingDefinition.required}
                      name={`fieldMapping${index + 1}Required`}
                      type="checkbox"
                    />
                    Required
                  </label>
                </div>
              );})}
            </div>
          </div>
          <label className="mt-6 block space-y-2">
            <span className="text-sm font-medium">Sample CSV</span>
            <textarea
              className="min-h-44 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 font-mono text-sm outline-none"
              defaultValue={[
                "full_name,email,phone,notes",
                "Avery Mason,avery@example.com,5551112222,Qualified lead",
                "Jordan Lee,jordan@example.com,5553334444,Needs parking",
              ].join("\n")}
              name="sampleCsv"
            />
          </label>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
            {messagingSettings.csvImportIntegration.summary}
          </div>
          {messagingSettings.csvImportIntegration.preview ? (
            <div className="mt-5 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Validation preview</div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    Headers: {messagingSettings.csvImportIntegration.preview.headerFields.join(", ") || "None"}
                  </div>
                </div>
                <div className="text-sm text-[var(--color-muted)]">
                  {messagingSettings.csvImportIntegration.preview.validRowCount} valid · {messagingSettings.csvImportIntegration.preview.invalidRowCount} invalid
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {messagingSettings.csvImportIntegration.preview.rows.map((row) => (
                  <div
                    key={row.rowNumber}
                    className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"
                  >
                    <div className="font-medium">
                      Row {row.rowNumber} · {row.status}
                    </div>
                    <div className="mt-1 text-[var(--color-muted)]">
                      {row.fullName ?? "No name"}
                      {row.email ? ` · ${row.email}` : ""}
                      {row.phone ? ` · ${row.phone}` : ""}
                    </div>
                    {row.errors.length > 0 ? (
                      <div className="mt-2 text-[var(--color-accent-strong)]">
                        {row.errors.join(" | ")}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <input type="hidden" name="redirectTo" value="/app/settings/integrations" />
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
              type="submit"
            >
              Save CSV mapping and preview
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
