import { PageHeader } from "@/components/page-header";
import { CalendarSyncProvider } from "@/generated/prisma/client";
import { updateWorkspaceQuietHoursAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateWorkspaceMessagingThrottleSettingsAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateOperatorSchedulingAvailabilityAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateWorkspaceCalendarConnectionAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateWorkspaceScreeningConnectionAction } from "@/app/(app)/app/settings/integrations/actions";
import { updateWorkspaceTourSchedulingSettingsAction } from "@/app/(app)/app/settings/integrations/actions";
import { getMessagingSettingsViewData } from "@/lib/app-data";
import { availabilityDayOptions } from "@/lib/availability-windows";
import { validateInboundIntegrationConfiguration } from "@/lib/integration-config-validation";
import { onboardingChannelOptions } from "@/lib/onboarding";
import {
  screeningChargeModeOptions,
  screeningConnectionAuthStateOptions,
  screeningProviderOptions,
} from "@/lib/screening";
import { calendarConnectionStatusOptions, tourSchedulingModeOptions } from "@/lib/tour-scheduling";

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
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    microsoftClientId: process.env.MICROSOFT_CLIENT_ID,
    microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
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

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">WhatsApp business messaging</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            {messagingSettings.hasWhatsAppMessagingCapability
              ? "Org workspaces can now stage WhatsApp conversations on the lead thread. Provider wiring still needs production credentials before delivery can succeed."
              : "WhatsApp messaging is reserved for Org workspaces and stays hidden from Personal plans."}
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
            {messagingSettings.hasWhatsAppMessagingCapability
              ? "Conversation support is enabled for this workspace."
              : "Upgrade to Org to enable WhatsApp messaging controls."}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Instagram business messaging</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            {messagingSettings.hasInstagramMessagingCapability
              ? "Org workspaces can now keep Instagram conversation context on the lead thread. Delivery remains provider-unresolved until a business messaging adapter is configured."
              : "Instagram messaging is reserved for Org workspaces and stays hidden from Personal plans."}
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
            {messagingSettings.hasInstagramMessagingCapability
              ? "Conversation support is enabled for this workspace."
              : "Upgrade to Org to enable Instagram messaging controls."}
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
