# Roomflow TODOs

This file turns the current docs into an execution-focused starting plan.

It is intentionally biased toward the narrowest usable v1 described in:

* [README.md](./README.md)
* [reference/SITEMAP.md](./reference/SITEMAP.md)
* [reference/TECHSTACK.md](./reference/TECHSTACK.md)

## Current project state

The repository now contains the first Next.js + Prisma scaffold, working auth, automatic workspace bootstrap, and seeded Prisma-backed dashboard, leads, properties, rule, and template routes. Background automation and messaging jobs are still pending.

## v1 implementation target

Build the narrowest useful workflow first:

* marketing entry
* auth
* first property setup
* house-rule setup
* lead list
* lead detail
* message templates
* qualification routing groundwork

Do not start with:

* marketplace integrations for every source
* billing
* analytics depth
* advanced calendar features
* microservices

## Phase 0: repo bootstrap

- [x] Initialize the app as a Next.js project on Node.js with the App Router
- [x] Add TypeScript, ESLint, Prettier, and a basic editorconfig
- [x] Add the core dependencies from the stack doc:
  `prisma`, `@prisma/client`, `better-auth`, `zod`, `react-hook-form`, `resend`, `twilio`, `pg-boss`
- [x] Add env handling and create `.env.example`
- [x] Add a basic Docker setup for local development with:
  * app
  * postgres
- [x] Add a `README` section for local startup once the scaffold exists

## Phase 1: app foundation

- [x] Create the top-level route groups:
  * public marketing routes
  * auth routes
  * protected app routes
- [x] Create a shared app shell with:
  * sidebar nav
  * top utility bar
  * workspace/property context placeholder
- [x] Define the initial design tokens and reusable layout primitives
- [x] Add core UI primitives:
  * button
  * input
  * select
  * textarea
  * card
  * table
  * badge
  * modal or drawer
  * stepper

## Phase 2: database and domain model

- [x] Initialize Prisma and create the first schema
- [x] Model the minimum core entities:
  * user
  * organization or workspace
  * property
  * lead source
  * lead
  * contact
  * conversation
  * message
  * qualification question set
  * qualification answer
  * property rule
  * message template
  * lead status history
  * audit event
- [x] Decide early whether `room` is a real v1 model or explicitly deferred (see `reference/DEFERRALS.md`)
- [x] Add the first Prisma migration for local development
- [x] Create a small set of realistic seed records for:
  * one workspace
  * one property
  * several leads in different statuses
  * a few message templates
  * a few house rules

## Phase 3: auth and protected access

- [x] Integrate Better Auth
- [x] Build `/login`
- [x] Build `/signup`
- [x] Add protected-route enforcement for `/app`
- [x] Add the minimal account bootstrap needed to create a workspace
- [x] Defer team management until after single-user flow works (see `reference/DEFERRALS.md`)

## Phase 4: onboarding flow

These routes should be implemented before deep workflow screens.

- [x] Build `/onboarding`
- [x] Build `/onboarding/property`
- [x] Build `/onboarding/house-rules`
- [x] Build `/onboarding/channels`
- [x] Keep channel setup realistic for v1:
  * direct support: manual entry, inbound email, inbound SMS
  * source-tag only: Facebook, Zillow, SpareRoom, Roomster, Craigslist
- [x] Persist onboarding completion state and redirect completed users into `/app`

## Phase 5: first usable product slice

These are the pages from the sitemap that actually let the product exist.

- [x] Build `/`
- [x] Build `/app`
- [x] Build `/app/leads`
- [x] Build `/app/leads/[leadId]`
- [x] Build `/app/properties/[propertyId]/rules`
- [x] Build `/app/templates`

Definition of done for this slice:

* an operator can sign up
* create a property
* define house rules
* see seeded or entered leads
* open a lead detail page
* review qualification answers
* see fit status
* choose a next action
* manage reusable follow-up templates

## Phase 6: lead workflow services

The UI will be weak unless these backend capabilities exist.

- [x] Implement lead normalization into one internal schema
- [x] Implement qualification status states:
  * new
  * awaiting_response
  * incomplete
  * qualified
  * tour_scheduled
  * application_sent
  * declined
  * archived
- [x] Implement property-specific rule evaluation
- [x] Implement qualification result states:
  * pass
  * caution
  * mismatch
  * unknown
- [x] Implement timeline or activity feed generation from event data
- [x] Implement message-template rendering with variables
- [x] Log all important workflow actions to an append-only audit event stream

### Follow-up adjustments

- [x] Guard `schedule_tour` against missing property or scheduling link before performing workflow actions and mark the action unavailable when not configured.
- [x] Extend normalized inbound ingestion to emit a diary/audit entry with delivery metadata for each email/SMS before outbound follow-up starts.
- [x] Prevent queued outbound sends from failing outright when provider credentials are placeholders by tracking a “provider unresolved” state and exposing it for retry logic.
- [x] Add idempotency tracking (external message/thread IDs) in webhook handlers so retries from email/SMS do not create duplicate leads.
- [x] Fall back to a default source label when dashboard summaries encounter leads without an assigned source and consider logging those anomalies for future hygiene work.
## Phase 7: messaging and async jobs

This is required for the README promise of automated follow-up.

- [x] Add `pg-boss` and create a worker entrypoint
- [x] Add job types for:
  * delayed follow-up
  * reminder send
  * webhook processing
  * retryable outbound message send
- [x] Implement Resend for outbound email
- [x] Implement Twilio for SMS
- [x] Build webhook endpoints for inbound email/SMS normalization
- [x] Store outbound and inbound messages in one conversation model
- [x] Record delivery failures and retry counts

## Phase 8: inbox and workflow depth

These come after the first usable product slice.

- [x] Build `/app/inbox`
- [x] Build `/app/properties/[propertyId]/questions`
- [x] Add request-missing-info action from both inbox and lead detail
- [x] Add assign-property action for unassigned leads
- [x] Add message thread view tied to the lead record

## Phase 9: scheduling handoff

- [x] Add a property-level scheduling link setting
- [x] Add a lead action to send scheduling handoff only for qualified leads
- [x] Log scheduling invite events in the audit timeline
- [x] Build a minimal `/app/calendar` view only after handoff links work

## Phase 10: dashboard and reporting basics

- [x] Build `/app` dashboard widgets from real data
- [x] Show:
  * new leads today
  * awaiting response
  * qualified leads
  * declined leads
  * recent activity
- [x] Add basic source and status summaries
- [x] Defer full analytics until the event model is stable

## Phase 11: settings and integrations

- [x] Build `/app/settings`
- [x] Add minimal profile/account settings
- [x] Build `/app/settings/integrations` for:
  * inbound email setup placeholder
  * SMS provider setup
  * webhook endpoint display
  * CSV import placeholder
- [x] Defer `/app/settings/billing` until pricing and plan logic are real (see `reference/DEFERRALS.md`)

## Business-logic TODOs (from `reference/BUSINESSLOGIC.md`)

### State model and transitions (Sections 4, 5, 10, 26)

- [x] Extend `LeadStatus` with missing states from business logic: `UNDER_REVIEW`, `CAUTION`, `CLOSED`.
- [x] Keep `fitResult` (`UNKNOWN`, `PASS`, `CAUTION`, `MISMATCH`) separate from status in all write paths.
- [x] Add a shared transition guard (`isAllowedLeadTransition`) based on Section 26.
- [x] Enforce transition guard in all lead status server actions.
- [x] Reject invalid transitions with typed errors and user-facing action messages.
- [x] Add `fromStatus`, `toStatus`, `reason`, and actor metadata to every transition write.
- [x] Add tests covering each allowed transition and at least one blocked transition per status.

### Roles and permissions (Sections 2, 20)

- [x] Align membership roles with business logic (`OWNER`, `ADMIN`, `MANAGER`, `VIEWER`).
- [x] Define permission matrix for lead actions (qualify, decline, override, schedule, invite, archive).
- [x] Apply role checks to server actions and API routes.
- [x] Hide or disable unavailable UI actions based on role.
- [x] Emit audit events for denied privileged actions.

### Inquiry ingestion and duplicate handling (Sections 6, 22)

- [x] Support inbound source typing for manual, email, SMS, CSV import, and web form.
- [x] Normalize inbound identity keys (email lowercase, phone E.164).
- [x] Implement duplicate confidence scoring using exact email, exact phone, and recent thread association.
- [x] Attach inquiry to existing lead when confidence is high.
- [x] Flag `possible_duplicate` when confidence is ambiguous.
- [x] Add operator merge/confirm duplicate action in lead review flow.
- [x] Persist external message/thread IDs for idempotent webhook replay handling.
- [x] Add duplicate metrics to audit/events for future reporting.

### Lead normalization and extraction confidence (Section 7)

- [x] Define normalized field schema for move-in, budget, stay length, smoking, pets, parking, guests, bathroom acceptance, and work status.
- [x] Persist per-field metadata: `value`, `source`, `confidence`, `lastUpdatedAt`.
- [x] Prevent low-confidence extraction from overwriting operator-confirmed values.
- [x] Mark low-confidence fields as `suggested` for manual review.
- [x] Surface extracted-field confidence in lead detail UI.
- [x] Re-run normalization safely when new inquiry text arrives.
- [x] Emit `lead.normalized` audit event with changed fields.

### Qualification prerequisites and questionnaire flow (Section 8)

- [x] Block qualification automation when lead has no assigned property.
- [x] Block automation when property has no active question set.
- [x] Block automation when no contactable channel exists unless manual-only mode is enabled.
- [x] Enforce required vs optional question behavior on fit computation.
- [x] Keep fit at `UNKNOWN` when required questions are unanswered.
- [x] Add missing-question resolver used by inbox and lead detail actions.
- [x] Prevent duplicate dispatch of the same missing-info prompt within throttle window.
- [x] Add qualification completion check: required answers complete + fit computed + routed outcome.

### Rule engine and fit evaluation (Sections 9, 25, 28)

- [x] Standardize property rule categories: smoking, pets, guests, bathroom sharing, parking, minimum stay, work schedule, acknowledgment.
- [x] Support rule behavior modes: blocking, warning-only, informational.
- [x] Compute fit deterministically from answers + active rules.
- [x] Set fit to `MISMATCH` for blocking rule violations.
- [x] Set fit to `CAUTION` for warning rules unless already mismatch.
- [x] Keep informational rules visible but non-blocking.
- [x] Emit detailed rule evaluation events (triggered rule IDs, severity, explanation).
- [x] Recompute fit on answer changes, rule changes, property reassignment, and override confirmation.

### Routing and manual overrides (Sections 10, 18)

- [x] Implement routing Case A (missing required data -> `AWAITING_RESPONSE` or `INCOMPLETE`).
- [x] Implement routing Case B (blocking mismatch -> `UNDER_REVIEW` or `DECLINED` per policy).
- [x] Implement routing Case C (all pass -> `QUALIFIED` with optional next-step send).
- [x] Implement routing Case D (warning -> `UNDER_REVIEW`).
- [x] Add manual override action for fit and status with mandatory reason.
- [x] Capture prior/new values for override in immutable audit event payload.
- [x] Add dedicated review queue view filters for duplicate, caution, mismatch, and conflict cases.
- [x] Add operator actions from review queue: request info, qualify, decline, reassign property, schedule.

### Messaging, throttling, and opt-out (Sections 11, 12)

- [x] Add message origin enum support for `inbound`, `outbound_manual`, `outbound_automated`, `system_notice`.
- [x] Store and enforce per-workspace or per-property channel priority order.
- [x] Enforce send preconditions: lead active, channel valid, no opt-out, throttle window respected.
- [x] Add per-lead daily automated send cap.
- [x] Prevent automated duplicate template sends without meaningful state change.
- [x] Add lead-level opt-out state and disable automation when opted out.
- [x] Keep manual review and manual outbound available after opt-out.
- [x] Add safe template rendering with variable fallback/suppression rules.
- [x] Block outbound send when unresolved template tokens remain.
- [x] Record the rendered message snapshot in message/audit records.

### Tour scheduling and application handoff (Sections 13, 14, 22)

- [x] Add `TourEvent` model with status, scheduled time, cancel reason, and optional external calendar ID.
- [x] Enforce scheduling prerequisites (qualified or manually allowed, scheduling enabled).
- [x] Set lead status to `TOUR_SCHEDULED` on successful schedule.
- [x] On cancel, retain event history and route lead back to `QUALIFIED` or `UNDER_REVIEW`.
- [x] Add reschedule flow that preserves timeline continuity.
- [x] Enforce application invite prerequisites before sending.
- [x] Set status to `APPLICATION_SENT` with invite timestamp and channel.
- [x] Track stale application invites and enqueue reminders.
- [x] Emit scheduling and application webhook events for downstream integrations.

### Decline, archive, and stale policy (Sections 15, 16)

- [x] Add structured decline reason enum (`RULE_MISMATCH`, `MISSING_INFO`, `OPERATOR_DECISION`, `NO_AVAILABILITY`, `UNRESPONSIVE`, `DUPLICATE`, `WITHDREW`).
- [x] Require decline reason on all decline actions.
- [x] Add soft decline flag and allow reversible declines in v1.
- [x] Stop active automations immediately on decline.
- [x] Implement stale detection jobs for no-response, no-operator-action, and stale-invite cases.
- [x] Add stale markers and stale timestamps on leads.
- [x] Queue reminder and archive-suggestion jobs from stale policy rules.
- [x] Add archive automation after stale threshold with operator override option.

### Activity timeline and audit guarantees (Sections 19, 28)

- [x] Define canonical event names (`lead_created`, `qualification_started`, `fit_computed`, etc.).
- [x] Ensure every material action writes an immutable timeline/audit event.
- [x] Include actor type (`system` or `user`) and actor ID when available.
- [x] Include old/new state snapshots for status/fit/routing changes.
- [x] Include structured metadata payload for rule results and message delivery outcomes.
- [x] Backfill missing events for existing seeded flows where practical.
- [x] Add timeline ordering and dedupe guarantees for near-simultaneous events.

### Notifications and integrations (Sections 21, 22)

- [x] Add in-app notification events for new lead, caution review, mismatch, stale lead, scheduled tour, stale application invite.
- [x] Add email notification hooks for owner/admin alerts.
- [x] Add integration config validation for inbound email/SMS parsing sources.
- [x] Emit outbound webhooks for `lead.created`, `lead.qualified`, `lead.declined`, `tour.scheduled`, `application.sent`.
- [x] Add webhook retry/backoff and dead-letter handling for failed deliveries.
- [x] Add webhook signature verification for inbound provider calls.

### Billing usage counters (Section 23)

- [x] Add non-blocking usage counters for active properties, monthly leads, automation sends, and seats.
- [x] Add periodic aggregation job for usage snapshots.
- [x] Surface soft plan warnings in settings/dashboard.
- [x] Keep operational flows unblocked when limits are reached in v1.

### Error and conflict handling (Section 24)

- [x] Add explicit handling for missing channel errors during automation.
- [x] Add invalid answer parsing pathway with clarification prompt support.
- [x] Preserve conflicting answers in history and mark field conflict state.
- [x] Trigger fit recomputation and review-queue entry on conflicting answers.
- [x] Add template render failure event and suppress unsafe send.
- [x] Add provider-unresolved delivery state for missing Resend/Twilio credentials.
- [x] Add retry strategy that skips non-retryable configuration errors.

### KPI derivation and reporting (Section 27)

- [x] Add event-derived metric: leads created by source.
- [x] Add event-derived metric: average time to first response.
- [x] Add event-derived metric: qualification completion rate.
- [x] Add event-derived metric: fit distribution (pass/caution/mismatch/unknown).
- [x] Add event-derived metric: inquiry-to-tour conversion.
- [x] Add event-derived metric: inquiry-to-application conversion.
- [x] Add event-derived metric: average time spent in each lead status.
- [x] Add event-derived metric: decline reason distribution.

### Delivery slices and tests (Section 29)

- [x] Slice 1 hardening: lead creation, normalization, property assignment, status writes, timeline events.
- [x] Slice 2 hardening: qualification questions, answer storage, missing-answer detection, follow-up triggers.
- [x] Slice 3 hardening: rule engine, fit compute, review routing, override path.
- [x] Slice 4 hardening: template controls, outbound safeguards, tour scheduling, application invite.
- [x] Slice 5 hardening: stale handling, KPI derivation, notifications.
- [x] Add integration tests for end-to-end lead lifecycle from inquiry to decline/tour/application.
- [x] Add regression tests for routing case matrix (A-D) and status machine constraints.

## First prototype build order

If the goal is to start implementation immediately, do the next tasks in exactly this order:

1. Initialize Next.js app and local Postgres
2. Add Prisma schema and seed data
3. Add auth
4. Build protected app shell
5. Build onboarding property page
6. Build onboarding house-rules page
7. Build leads list page
8. Build lead detail page
9. Build property rules page
10. Build templates page

## First coding milestone

The first meaningful milestone is not "all routes exist."

It is:

"A landlord can sign up, create a property, define house rules, view a lead, review fit, and choose a next step."

## Explicit deferrals

Do not pull these into the first implementation pass:

* `/features`
* `/how-it-works`
* `/app/analytics`
* `/app/settings/billing`
* `/app/waitlist`
* `/app/applications`
* `/app/workflows`
* `/app/audit`
* `/app/messages`
* `/app/channels`
* `/app/rooms`

## Post-v1 feature backlog (derived from `reference/FEATURES.md`)

These are not part of the original narrow launch slice, but they are now broken down so future planning can happen without re-reading the full feature spec.

## Phase 12: auth expansion and identity hardening

- [x] Build `/forgot-password` request flow and `/reset-password` completion flow.
- [x] Build `/verify-email` and enforce verification gates for non-trusted providers.
- [x] Add magic-link login and recovery flow with single-use token expiry.
- [x] Add Google login with safe account-linking behavior for existing verified emails.
- [x] Add Facebook / Meta login for channel-heavy operators.
- [x] Add Microsoft login for Org workspaces.
- [x] Add Apple login with private-relay email handling.
- [ ] Add optional passkey registration and sign-in.
- [x] Add account-linking UI and server actions for multiple auth methods on one identity.
- [x] Add session and device management UI for revoking active sessions.
- [x] Add workspace invite acceptance flow for existing and new users.
- [x] Add workspace switching UI for users with access to multiple workspaces.

## Phase 13: workspace, plans, and account packaging

- [x] Add workspace subscription model fields for plan type, status, billing owner, and enabled capabilities.
- [x] Distinguish Personal vs Org capabilities in settings and route guards.
- [x] Add soft upgrade prompts when users hit Org-only features.
- [x] Implement safe downgrade behavior that disables unsupported features without deleting data.
- [ ] Add usage-counter display for plan-limited capabilities in settings.
- [ ] Add billing-owner transfer flow for multi-admin workspaces.

## Phase 14: property operations and listing management

- [ ] Build `/app/properties` as a first-class property index with filters and status chips.
- [ ] Build `/app/properties/[propertyId]` with full property summary, amenities, channel settings, and scheduling config.
- [ ] Add property active/inactive/archive lifecycle controls.
- [ ] Add listing source metadata fields per property.
- [ ] Add listing sync status model and UI states: healthy, pending, failed, out of date.
- [ ] Add property-level calendar target selection.
- [ ] Add listing performance summary cards per property.
- [ ] Add operator workflow for editing parking, bathroom-sharing, and room-count details.

## Phase 15: communications hub depth

- [ ] Add internal notes to leads and message threads.
- [ ] Add teammate @mentions in private notes.
- [ ] Add formal message types for screening invite, tour invite, application invite, house-rules acknowledgment, onboarding, decline, and waitlist notice.
- [ ] Add branded message formatting for structured invitations and notices.
- [ ] Add delivery/read-state UI where provider data is available.
- [ ] Add quiet-hours configuration per workspace or property.
- [ ] Add throttling configuration UI and operator-visible suppression reasons.
- [ ] Add opt-out event visibility and channel-specific opt-out controls.
- [ ] Add WhatsApp conversation support behind integration capability flags.
- [ ] Add Instagram business messaging support behind integration capability flags.
- [ ] Add shared-thread timeline that cleanly mixes email, SMS, WhatsApp, Instagram, notes, and system events.

## Phase 16: AI-assisted workflow tools

- [ ] Add extracted-field evidence display for inquiry-to-profile AI output.
- [ ] Add operator accept/edit/reject flow for AI-suggested field values.
- [ ] Add AI-generated lead summaries on lead detail and inbox surfaces.
- [ ] Add AI reply drafting for common operator actions.
- [ ] Add AI follow-up drafting tied to missing-info state and property context.
- [ ] Add AI conflict explanations for caution and mismatch outcomes.
- [ ] Add AI next-best-action recommendations on the lead detail page.
- [ ] Add AI duplicate suggestions without auto-merge.
- [ ] Add inbound/outbound translation tools while preserving original text.
- [ ] Add AI listing analyzer UI for clarity and expectation-mismatch recommendations.
- [ ] Add AI house-rules generator during onboarding and property setup.
- [ ] Add AI intake-form generator for property-specific questionnaires.
- [ ] Add reusable AI workflow-template generator.
- [ ] Add Org-only portfolio AI insight summaries.
- [ ] Add stale-lead AI recommendations for archive, reminder, review, or re-engagement.

## Phase 17: workflow builder and automation templates

- [ ] Build `/app/workflows` for workflow list, status, and template management.
- [ ] Define workflow entities for triggers, conditions, actions, versions, and scope.
- [ ] Build a node-based workflow builder UI.
- [ ] Implement trigger catalog for lead created, message received, fit changed, tour scheduled, screening completed, application sent, and stale threshold reached.
- [ ] Implement condition catalog for property, fit, channel availability, missing fields, inactivity window, and status.
- [ ] Implement action catalog for send template, draft AI message, create task, assign lead, move status, notify operator, schedule reminder, and request approval.
- [ ] Add approval-required steps for sensitive declines and screening-related actions.
- [ ] Add starter workflow templates for follow-up, reminder, and stale-lead handling.
- [ ] Add property-specific workflow overrides.
- [ ] Add Org-wide automation library and sharing rules.

## Phase 18: scheduling and calendar depth

- [ ] Add manual tour creation UI separate from automated scheduling handoff.
- [ ] Add availability-window configuration by user and property.
- [ ] Add Google Calendar integration for event sync.
- [ ] Add Outlook calendar integration for event sync.
- [ ] Add reschedule and cancel flows with operator-facing reasons and prospect notifications.
- [ ] Add team scheduling support for Org workspaces.
- [ ] Add round-robin scheduling option for shared lead coverage.
- [ ] Add no-show tracking as a structured tour outcome.
- [ ] Add reminder-message sequencing tied to scheduled tours.

## Phase 19: screening and verification orchestration

- [ ] Build screening provider connection model with package selection and auth state.
- [ ] Build screening launch flow from qualified leads.
- [ ] Add screening status tracker with requested, invite sent, consent completed, in progress, completed, reviewed, and adverse-action recorded states.
- [ ] Store screening report references and provider timestamps.
- [ ] Add consent and authorization tracking to the lead timeline.
- [ ] Add pass-through screening charge model hooks for future billing.
- [ ] Add operator review workflow for completed screening results.
- [ ] Add adverse-action workflow tracking without automating the decision itself.

## Phase 20: integrations expansion

- [ ] Build a unified integration connection model with provider type, auth state, mapping config, health state, and sync history.
- [ ] Expand `/app/settings/integrations` into a real integrations hub with setup wizards and health monitoring.
- [ ] Add generic inbound webhook ingestion configuration UI.
- [ ] Add CSV import flow with field mapping and validation preview.
- [ ] Add CSV export for leads, messages, and activity.
- [ ] Add Meta Lead Ads ingestion.
- [ ] Add WhatsApp provider integrations.
- [ ] Add Instagram messaging integration.
- [ ] Add Zillow feed or listing sync path.
- [ ] Add Apartments.com feed or listing sync path.
- [ ] Add Slack notification integration.
- [ ] Add outbound automation webhooks for Zapier, Make, and n8n-style consumers.
- [ ] Add S3-compatible file storage integration for future attachments.

## Phase 21: external portals and public acquisition flows

- [ ] Build `/features` with detailed product capability sections.
- [ ] Build `/how-it-works` with the lead funnel walkthrough.
- [ ] Expand `/pricing` to reflect Personal vs Org packaging.
- [ ] Build branded scheduling page for external prospect self-booking.
- [ ] Build branded house-rules acknowledgment page.
- [ ] Build prospect status page with lightweight next-step visibility.
- [ ] Build waitlist signup page for unavailable inventory.
- [ ] Build public lead capture form with secure workspace routing.
- [ ] Build embedded qualification form for use on external sites.
- [ ] Build public AI-tool landing pages as acquisition funnels.
- [ ] Build prospect portal shell for invites, appointments, and acknowledgments.

## Phase 22: Org and team collaboration

- [ ] Build multi-user invite and membership-management flows.
- [ ] Expand role and permission system from current v1 checks into Org-grade management tooling.
- [ ] Add lead, review-item, and task assignment to specific teammates.
- [ ] Add shared inbox ownership and triage controls.
- [ ] Add internal comments on leads and messages distinct from external communications.
- [ ] Add first-class task model with due dates and assignees.
- [ ] Add SLA timer model and overdue highlighting for lead response and review.
- [ ] Build `/app/settings/team` for memberships, roles, and invite status.
- [ ] Add property-level permission scoping for larger teams.
- [ ] Build `/app/audit` for sensitive-action history and filters.
- [ ] Add activity log views by user.

## Phase 23: analytics and reporting expansion

- [ ] Build `/app/analytics` with funnel, source, property, and stale-lead views.
- [ ] Add inquiry-to-qualified, inquiry-to-tour, and inquiry-to-application funnel charts.
- [ ] Add source-quality comparison views across listing channels and campaigns.
- [ ] Add rule-friction analytics showing which rules or questions most often block progression.
- [ ] Add property-performance comparisons across lead volume, fit rate, and conversion.
- [ ] Add team-performance metrics for Org workspaces.
- [ ] Add AI-usage analytics showing suggestion volume and acceptance rate.
- [ ] Add integration-health analytics for connected systems.
- [ ] Add saved report filters and time windows.

## Phase 24: billing and monetization

- [ ] Build `/app/settings/billing` once pricing and payment requirements are finalized.
- [ ] Add subscription record management for Personal and Org plans.
- [ ] Add seat-based and workspace-based billing primitives.
- [ ] Add SMS overage metering or cap visibility.
- [ ] Add screening pass-through billing hooks.
- [ ] Add invoice and billing-history views for workspace owners.
- [ ] Add plan-change flow with confirmation and proration rules.
- [ ] Add premium integration packaging flags for future upsells.
- [ ] Add premium onboarding/package placeholders without blocking core flows.

## Phase 25: trust, safety, and compliance

- [ ] Add consent evidence storage and review UI for screening and verification steps.
- [ ] Add admin security controls for revoking sessions and reviewing login activity.
- [ ] Add manual-review checkpoints for sensitive automated workflows.
- [ ] Add secure attachment upload model with access controls and audit events.
- [ ] Add risky integration-state warnings and remediation prompts.
- [ ] Add operator-visible compliance warnings for opt-out and consent-sensitive actions.

## Phase 26: later-stage nice-to-haves

- [ ] Add voice and call tracking.
- [ ] Add voicemail transcription.
- [ ] Add missed-call-to-text fallback.
- [ ] Add e-sign acknowledgment flow.
- [ ] Add move-in onboarding pack generation.
- [ ] Add roommate etiquette pack generation.
- [ ] Add utility setup referral flows.
- [ ] Add insurance referral flows.
- [ ] Add lockbox or showing-tool integrations.
- [ ] Add resident onboarding workflows after lead-to-move-in handoff is mature.
