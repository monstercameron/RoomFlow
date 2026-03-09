import { redirect } from "next/navigation";
import { ContactChannel } from "@/generated/prisma/client";
import {
  LeadCreateFormContent,
  LeadCreatePendingOverlay,
  LeadCreateSubmitButton,
} from "@/components/lead-create-form-state";
import {
  LeadCreateBackLink,
  LeadCreatePageShell,
} from "@/components/lead-create-page-shell";
import { getLeadCreateViewData } from "@/lib/app-data";
import {
  buildCreateLeadRetryPath,
  CreateManualLeadActionError,
  handleCreateManualLeadAction,
} from "@/lib/manual-leads";

type NewLeadPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
    fullName?: string;
    leadSourceId?: string;
    monthlyBudget?: string;
    moveInDate?: string;
    notes?: string;
    phone?: string;
    preferredContactChannel?: string;
    propertyId?: string;
  }>;
};

const preferredChannelOptions = [
  {
    description: "Best when the lead mainly replies over email.",
    label: "Email",
    value: ContactChannel.EMAIL,
  },
  {
    description: "Best when the lead should receive texts.",
    label: "SMS",
    value: ContactChannel.SMS,
  },
  {
    description: "Best when the lead expects a call.",
    label: "Phone",
    value: ContactChannel.PHONE,
  },
];

const secondaryActionClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[rgba(184,88,51,0.18)] bg-[rgba(249,240,231,0.96)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] shadow-[0_8px_18px_rgba(62,43,28,0.05)] transition-[color,background-color,border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.3)] hover:bg-[rgba(255,247,239,0.98)] hover:text-[rgb(123,54,29)] hover:shadow-[0_14px_28px_rgba(62,43,28,0.08)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,88,51,0.08)]";

const formControlClassName =
  "w-full rounded-2xl border border-[rgba(184,88,51,0.16)] bg-[rgba(255,255,255,0.96)] px-4 py-3 text-sm text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(62,43,28,0.05)] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[rgba(109,103,93,0.85)] focus:border-[rgba(184,88,51,0.3)] focus:bg-white focus:ring-4 focus:ring-[rgba(184,88,51,0.08)]";

const sectionCardClassName =
  "rounded-[1.75rem] border border-[rgba(184,88,51,0.12)] bg-[rgba(255,250,245,0.72)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] md:p-6";

export default async function NewLeadPage({ searchParams }: NewLeadPageProps) {
  const resolvedSearchParams = await searchParams;
  const leadCreateViewData = await getLeadCreateViewData();

  async function saveLead(formData: FormData) {
    "use server";

    try {
      const createdLead = await handleCreateManualLeadAction(formData);
      redirect(`/app/leads/${createdLead.id}`);
    } catch (error) {
      if (error instanceof CreateManualLeadActionError) {
        redirect(buildCreateLeadRetryPath("/app/leads/new", formData, error.message));
      }

      throw error;
    }
  }

  const defaultPreferredChannel = isPreferredChannel(
    resolvedSearchParams.preferredContactChannel,
  )
    ? resolvedSearchParams.preferredContactChannel
    : ContactChannel.EMAIL;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 md:px-8">
      <LeadCreatePageShell>
        <form
          action={saveLead}
          className="relative overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)]"
          noValidate
        >
          <LeadCreateFormContent>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
                Manual lead intake
              </div>
              <LeadCreateBackLink
                className={secondaryActionClassName}
                href="/app/leads"
              >
                <span aria-hidden="true">←</span>
                Back to leads
              </LeadCreateBackLink>
            </div>

            <h1 className="mt-3 text-4xl font-semibold">Add a lead</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
              Capture a direct inquiry, assign it to the current operator, and drop it straight into the qualification queue with enough context to keep follow-up moving.
            </p>

            {resolvedSearchParams.error ? (
              <div
                className="mt-6 rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]"
                role="alert"
              >
                {resolvedSearchParams.error}
              </div>
            ) : null}

          <div className="mt-8 space-y-6">
            <section className={sectionCardClassName}>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Lead details
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium">Lead name</span>
                  <input
                    autoFocus
                    className={formControlClassName}
                    defaultValue={resolvedSearchParams.fullName ?? ""}
                    maxLength={120}
                    name="fullName"
                    placeholder="Avery Mason"
                    required
                    type="text"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">Email</span>
                  <input
                    className={formControlClassName}
                    defaultValue={resolvedSearchParams.email ?? ""}
                    name="email"
                    placeholder="avery@example.com"
                    type="email"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">Phone</span>
                  <input
                    className={formControlClassName}
                    defaultValue={resolvedSearchParams.phone ?? ""}
                    name="phone"
                    placeholder="+1 555 123 4567"
                    type="tel"
                  />
                </label>
              </div>
            </section>

            <section className={sectionCardClassName}>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Qualification context
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Property</span>
                  <select
                    className={formControlClassName}
                    defaultValue={resolvedSearchParams.propertyId ?? ""}
                    name="propertyId"
                  >
                    <option value="">No property assigned yet</option>
                    {leadCreateViewData.properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">Lead source</span>
                  <select
                    className={formControlClassName}
                    defaultValue={
                      resolvedSearchParams.leadSourceId ??
                      leadCreateViewData.defaultLeadSourceId ??
                      ""
                    }
                    name="leadSourceId"
                  >
                    {leadCreateViewData.sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">Move-in date</span>
                  <input
                    className={formControlClassName}
                    defaultValue={resolvedSearchParams.moveInDate ?? ""}
                    name="moveInDate"
                    type="date"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">Monthly budget</span>
                  <input
                    className={formControlClassName}
                    defaultValue={resolvedSearchParams.monthlyBudget ?? ""}
                    min={0}
                    name="monthlyBudget"
                    placeholder="1350"
                    step={1}
                    type="number"
                  />
                </label>
              </div>
            </section>

            <section className={sectionCardClassName}>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Follow-up preferences
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {preferredChannelOptions.map((option) => (
                  <label className="block cursor-pointer" key={option.value}>
                    <input
                      className="peer sr-only"
                      defaultChecked={defaultPreferredChannel === option.value}
                      name="preferredContactChannel"
                      type="radio"
                      value={option.value}
                    />
                    <span className="flex h-full rounded-2xl border border-[rgba(28,26,22,0.08)] bg-[rgba(255,255,255,0.82)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition peer-checked:border-[rgba(184,88,51,0.24)] peer-checked:bg-[rgba(184,88,51,0.1)] peer-checked:shadow-[0_10px_24px_rgba(141,63,33,0.08)] hover:border-[rgba(184,88,51,0.16)] hover:bg-[rgba(255,255,255,0.94)]">
                      <span>
                        <span className="block text-sm font-semibold text-[var(--color-ink)]">
                          {option.label}
                        </span>
                        <span className="mt-2 block text-sm leading-6 text-[var(--color-muted)]">
                          {option.description}
                        </span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium">Operator notes</span>
                <textarea
                  className={`${formControlClassName} min-h-36`}
                  defaultValue={resolvedSearchParams.notes ?? ""}
                  name="notes"
                  placeholder="Context from the call, listing they asked about, timeline constraints, or anything the next teammate should see."
                />
              </label>
            </section>
          </div>

            <div className="mt-8 flex justify-end">
              <LeadCreateSubmitButton />
            </div>
          </LeadCreateFormContent>
          <LeadCreatePendingOverlay />
        </form>
      </LeadCreatePageShell>
    </main>
  );
}

function isPreferredChannel(value: string | undefined): value is ContactChannel {
  return (
    value === ContactChannel.EMAIL ||
    value === ContactChannel.SMS ||
    value === ContactChannel.PHONE
  );
}