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

### Full file-review testing audit follow-up (March 8, 2026)

Reviewed config and build files:

- [ ] Keep config/build files on transitive coverage only and validate them through lint, typecheck, build, and runtime checks: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `prisma.config.ts`, `docker-compose.yml`, `Dockerfile`.

Reviewed Prisma data layer:

- [ ] Add schema-level integration tests for `prisma/schema.prisma` covering key unique constraints, foreign-key cascades, and enum compatibility.
- [ ] Add deployment-safety integration checks for `prisma/migrations/**/*.sql`, especially workspace-property-lead relationships and newly added integration-hub tables.

Reviewed scripts:

- [ ] Keep `scripts/openai-realtime-smoke.ts`, `scripts/seed-test-user.ts`, `scripts/backfill-workflow-events.ts`, `scripts/bootstrap-pglite.js`, and `scripts/start-pglite.js` on runtime-only coverage unless they gain reusable logic.
- [x] Add queue/worker coverage around `scripts/worker.ts` indirectly through `src/lib/jobs.ts` handler registration and job execution tests.
- [ ] Expand `scripts/playwright-smoke.mjs` into a broader runtime suite. Current smoke coverage now exercises auth entry and recovery pages, dashboard/settings navigation, members access, workflow creation, lead detail notes, property detail and rules, logout, and persisted integration save flows. Onboarding completion, invite acceptance, richer lead actions, property question creation, and deeper workflow editing remain.

Reviewed untested core lib modules:

- [x] Add unit and integration tests for `src/lib/jobs.ts`: queue registration, enqueue helpers, retry behavior, outbound webhook delivery jobs, reminder jobs, and worker handler dispatch.
- [ ] Expand server-action tests for `src/lib/lead-actions.ts`: permission checks, decline reasons, status transitions, property assignment, manual outbound, channel opt-out updates, complete-tour, no-show, duplicate confirmation, override routing, screening launch, cancel-tour, reschedule-tour, screening-status-update, and manual create-tour flows are covered. Remaining gaps are workflow-emission-heavy branches.
- [ ] Expand server-action tests for `src/lib/property-actions.ts`: rule parsing, question configuration, and deeper lead re-evaluation triggers remain. Scheduling availability, calendar target, operational details, lifecycle, quiet hours, listing metadata, listing sync, and scheduling-link updates are covered.
- [x] Add server-action tests for `src/lib/workflow-actions.ts`: workflow create/update/publish flows, node and edge validation, versioning, and capability gating.
- [ ] Add server-action tests for `src/lib/ai-actions.ts`: artifact schema validation, capability checks, provider failure handling, and persisted AI artifact writes.
- [ ] Expand direct tests for `src/lib/lead-workflow.ts`: notification fan-out and outbound webhook queuing are covered. Workflow context loading and deeper workflow action side effects remain.
- [x] Add direct tests for `src/lib/notification-delivery.ts`: recipient filtering, missing-provider behavior, Resend failures, Slack gating, and Slack webhook failure handling.
- [x] Add direct tests for `src/lib/tour-communications.ts`: scheduled, cancelled, and rescheduled message generation and channel selection.
- [x] Add direct tests for `src/lib/workflow-data.ts`: workflow list aggregation, version status formatting, and builder view-data shaping.
- [x] Add direct tests for `src/lib/session.ts`: session lookup, failure recovery, and active-session listing behavior.
- [x] Add direct tests for `src/lib/auth-accounts.ts`: linked-account discovery, provider availability checks, and missing-env fallbacks.
- [x] Add direct tests for `src/lib/auth-urls.ts`: redirect safety, query encoding, and next-path sanitization.
- [ ] Keep `src/lib/auth-client.ts`, `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/onboarding.ts`, `src/lib/navigation.ts`, and `src/lib/workspaces.ts` on transitive coverage unless logic grows further.

Reviewed auth and settings actions:

- [x] Add tests for `src/app/(auth)/social-auth-actions.ts`: provider validation, redirect construction, and error paths.
- [x] Add tests for `src/app/(app)/app/settings/security/actions.ts`: password changes, session revocation, and account linking/unlinking behavior.
- [x] Add tests for `src/app/(app)/app/settings/members/actions.ts`: role permission checks, invite validation, member removal, and billing-owner restrictions.
- [x] Add tests for `src/app/(app)/app/settings/plan-actions.ts`: plan transitions, capability updates, and downgrade warnings.
- [x] Add tests for `src/app/(app)/app/settings/integrations/actions.ts`: quiet hours, throttle controls, operator availability, tour scheduling, calendar, screening, webhook, CSV, Slack, storage, messaging-channel, meta-lead-ads, outbound webhook, and listing-feed configuration saves.

Reviewed API routes and webhooks:

- [x] Add route tests for `src/app/api/webhooks/email/route.ts`: signature rejection, payload validation, job queue path, and direct fallback processing path.
- [x] Add route tests for `src/app/api/webhooks/sms/route.ts`: form-encoded parsing, signature rejection, queue path, and fallback processing path.
- [x] Add route tests for `src/app/api/webhooks/whatsapp/route.ts`: connection lookup, signature rejection, Twilio-style payload parsing, and direct processing fallback.
- [x] Add route tests for `src/app/api/webhooks/meta/instagram/route.ts`: verification handshake, signature validation, message extraction, and processing fallback.
- [x] Add route tests for `src/app/api/webhooks/meta/lead-ads/route.ts`: verification handshake, signature validation, field-data mapping, and external-id lead ingestion.
- [x] Add route tests for `src/app/api/workspace-invites/route.ts`: auth failure, bad role/email validation, capability gating, and successful invite creation.
- [x] Add route tests for `src/app/api/workspace-invites/accept/route.ts`: auth failure, missing token, invite acceptance, cookie setting, and redirect-path branching.
- [x] Add route tests for `src/app/api/workspaces/active/route.ts`: session validation and workspace resolution.
- [x] Add route tests for `src/app/api/integrations/csv-export/route.ts`: auth gating, dataset validation, workspace access checks, and CSV serialization for leads, messages, and activity.
- [x] Add route tests for `src/app/api/integrations/listing-feed/route.ts`: provider validation, workspace access checks, active-only filtering, and payload shaping.
- [x] Add route tests for `src/app/api/integrations/storage/manifest/route.ts`: auth gating, workspace resolution, and manifest preview formatting.
- [x] Cover `src/app/api/auth/[...all]/route.ts` transitively through auth integration and Playwright flows rather than direct handler tests.

Reviewed pages and user-facing routes:

- [x] Add Playwright coverage for auth pages: `src/app/(auth)/login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `magic-link/page.tsx`, `verify-email/page.tsx`.
- [ ] Add Playwright coverage for onboarding pages: `src/app/(auth)/onboarding/page.tsx`, `property/page.tsx`, `house-rules/page.tsx`, `channels/page.tsx`.
- [ ] Expand Playwright coverage for core app pages. Current smoke coverage hits `src/app/(app)/app/page.tsx`, `leads/page.tsx`, `leads/[leadId]/page.tsx`, `properties/page.tsx`, `properties/[propertyId]/page.tsx`, `properties/[propertyId]/rules/page.tsx`, `workflows/page.tsx`, `workflows/[workflowId]/page.tsx`, `settings/page.tsx`, `settings/integrations/page.tsx`, `settings/members/page.tsx`, and `settings/security/page.tsx`. Remaining runtime gaps are `properties/[propertyId]/questions/page.tsx`, `inbox/page.tsx`, `templates/page.tsx`, `calendar/page.tsx`, and `invite/[token]/page.tsx`, plus deeper action coverage on already-visited pages.
- [ ] Keep `src/app/layout.tsx`, `src/app/(app)/app/layout.tsx`, and `src/app/(marketing)/page.tsx` on Playwright/transitive coverage unless layout-specific regressions appear.

Reviewed components:

- [ ] Keep simple presentational UI primitives on transitive coverage only: `src/components/ui/Button.tsx`, `Input.tsx`, `Modal.tsx`, `Card.tsx`, `Select.tsx`, `Textarea.tsx`, `Table.tsx`, `Badge.tsx`, `Stepper.tsx`, plus `src/components/page-header.tsx`.
- [ ] Add component or E2E coverage for `src/components/workflow-builder-canvas.tsx`: node rendering, edge rendering, and builder interaction states.
- [ ] Add component or E2E coverage for `src/components/workspace-switcher.tsx`: workspace selection and active-workspace state changes.
- [ ] Add component or E2E coverage for `src/components/workspace-members-panel.tsx` and `workspace-invite-acceptance-panel.tsx`: member role display is exercised transitively through settings navigation, but invite state mutations and acceptance UI branches still need direct runtime coverage.
- [x] Add Playwright coverage for `src/components/logout-button.tsx`: sign-out flow and redirect.
- [ ] Keep `src/components/app-shell.tsx` and `src/components/app-sidebar.tsx` primarily on Playwright coverage, unless sidebar state logic expands.
- [ ] Add component and Playwright coverage for auth form components: `src/components/auth/login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `magic-link-form.tsx`, `verify-email-panel.tsx`, `account-methods-panel.tsx`, `session-management-panel.tsx`, and `social-sign-in-button.tsx`.

Reviewed existing Playwright runtime surface and missing scenarios:

- [ ] Add Playwright runtime test for invalid login and duplicate-signup failures.
- [ ] Add Playwright runtime test for password reset and magic-link recovery flows.
- [ ] Add Playwright runtime test for unverified-email resend and verification completion.
- [ ] Add Playwright runtime test for property creation, house-rule creation, and qualification-question creation.
- [ ] Add Playwright runtime test for lead decline, lead status changes, property assignment, and templated outbound messaging.
- [ ] Add Playwright runtime test for screening launch, template CRUD, and workflow builder node or edge editing.
- [ ] Add Playwright runtime test for teammate invite, workspace switching, password change, and social account linking from settings.
- [ ] Expand Playwright runtime test for integration connection flows: persisted settings save flows are covered. Inbound webhook-fed lead visibility and missing-provider error states remain.

Reviewed overall coverage map:

- [ ] Add a durable test matrix mapping each reviewed implementation file to direct coverage, transitive coverage, or remaining gap so the backlog stays synchronized with future file additions.

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
- [x] Add usage-counter display for plan-limited capabilities in settings.
- [x] Add billing-owner transfer flow for multi-admin workspaces.

## Phase 14: property operations and listing management

- [x] Build `/app/properties` as a first-class property index with filters and status chips.
- [x] Build `/app/properties/[propertyId]` with full property summary, amenities, channel settings, and scheduling config.
- [x] Add property active/inactive/archive lifecycle controls.
- [x] Add listing source metadata fields per property.
- [x] Add listing sync status model and UI states: healthy, pending, failed, out of date.
- [x] Add property-level calendar target selection.
- [x] Add listing performance summary cards per property.
- [x] Add operator workflow for editing parking, bathroom-sharing, and room-count details.

## Phase 15: communications hub depth

- [x] Add internal notes to leads and message threads.
- [x] Add teammate @mentions in private notes.
- [x] Add formal message types for screening invite, tour invite, application invite, house-rules acknowledgment, onboarding, decline, and waitlist notice.
- [x] Add branded message formatting for structured invitations and notices.
- [x] Add delivery/read-state UI where provider data is available.
- [x] Add quiet-hours configuration per workspace or property.
- [x] Add throttling configuration UI and operator-visible suppression reasons.
- [x] Add opt-out event visibility and channel-specific opt-out controls.
- [x] Add WhatsApp conversation support behind integration capability flags.
- [x] Add Instagram business messaging support behind integration capability flags.
- [x] Add shared-thread timeline that cleanly mixes email, SMS, WhatsApp, Instagram, notes, and system events.

## Phase 16: AI-assisted workflow tools

- [x] Add extracted-field evidence display for inquiry-to-profile AI output.
- [x] Add operator accept/edit/reject flow for AI-suggested field values.
- [x] Add AI-generated lead summaries on lead detail and inbox surfaces.
- [x] Add AI reply drafting for common operator actions.
- [x] Add AI follow-up drafting tied to missing-info state and property context.
- [x] Add AI conflict explanations for caution and mismatch outcomes.
- [x] Add AI next-best-action recommendations on the lead detail page.
- [x] Add AI duplicate suggestions without auto-merge.
- [x] Add inbound/outbound translation tools while preserving original text.
- [x] Add AI listing analyzer UI for clarity and expectation-mismatch recommendations.
- [x] Add AI house-rules generator during onboarding and property setup.
- [x] Add AI intake-form generator for property-specific questionnaires.
- [x] Add reusable AI workflow-template generator.
- [x] Add Org-only portfolio AI insight summaries.
- [x] Add stale-lead AI recommendations for archive, reminder, review, or re-engagement.

## Phase 17: workflow builder and automation templates

- [x] Build `/app/workflows` for workflow list, status, and template management.
- [x] Define workflow entities for triggers, conditions, actions, versions, and scope.
- [x] Build a node-based workflow builder UI.
- [x] Implement trigger catalog for lead created, message received, fit changed, tour scheduled, screening completed, application sent, and stale threshold reached.
- [x] Implement condition catalog for property, fit, channel availability, missing fields, inactivity window, and status.
- [x] Implement action catalog for send template, draft AI message, create task, assign lead, move status, notify operator, schedule reminder, and request approval.
- [x] Add approval-required steps for sensitive declines and screening-related actions.
- [x] Add starter workflow templates for follow-up, reminder, and stale-lead handling.
- [x] Add property-specific workflow overrides.
- [x] Add Org-wide automation library and sharing rules.

## Phase 18: scheduling and calendar depth

- [x] Add manual tour creation UI separate from automated scheduling handoff.
- [x] Add availability-window configuration by user and property.
- [x] Add Google Calendar integration for event sync.
- [x] Add Outlook calendar integration for event sync.
- [x] Add reschedule and cancel flows with operator-facing reasons and prospect notifications.
- [x] Add team scheduling support for Org workspaces.
- [x] Add round-robin scheduling option for shared lead coverage.
- [x] Add no-show tracking as a structured tour outcome.
- [x] Add reminder-message sequencing tied to scheduled tours.

## Phase 19: screening and verification orchestration

- [x] Build screening provider connection model with package selection and auth state.
- [x] Build screening launch flow from qualified leads.
- [x] Add screening status tracker with requested, invite sent, consent completed, in progress, completed, reviewed, and adverse-action recorded states.
- [x] Store screening report references and provider timestamps.
- [x] Add consent and authorization tracking to the lead timeline.
- [x] Add pass-through screening charge model hooks for future billing.
- [x] Add operator review workflow for completed screening results.
- [x] Add adverse-action workflow tracking without automating the decision itself.

## Phase 20: integrations expansion

- [x] Build a unified integration connection model with provider type, auth state, mapping config, health state, and sync history.
- [x] Expand `/app/settings/integrations` into a real integrations hub with setup wizards and health monitoring.
- [x] Add generic inbound webhook ingestion configuration UI.
- [x] Add CSV import flow with field mapping and validation preview.
- [x] Add CSV export for leads, messages, and activity.
- [x] Add Meta Lead Ads ingestion.
- [x] Add WhatsApp provider integrations.
- [x] Add Instagram messaging integration.
- [x] Add Zillow feed or listing sync path.
- [x] Add Apartments.com feed or listing sync path.
- [x] Add Slack notification integration.
- [x] Add outbound automation webhooks for Zapier, Make, and n8n-style consumers.
- [x] Add S3-compatible file storage integration for future attachments.

## Phase 21: external portals and public acquisition flows

- [x] Build `/features` with detailed product capability sections.
- [x] Build `/how-it-works` with the lead funnel walkthrough.
- [x] Expand `/pricing` to reflect Personal vs Org packaging.
- [x] Build branded scheduling page for external prospect self-booking.
- [x] Build branded house-rules acknowledgment page.
- [x] Build prospect status page with lightweight next-step visibility.
- [x] Build waitlist signup page for unavailable inventory.
- [x] Build public lead capture form with secure workspace routing.
- [x] Build embedded qualification form for use on external sites.
- [x] Build public AI-tool landing pages as acquisition funnels.
- [x] Build prospect portal shell for invites, appointments, and acknowledgments.

## Phase 22: Org and team collaboration

- [x] Build multi-user invite and membership-management flows.
- [x] Expand role and permission system from current v1 checks into Org-grade management tooling.
- [x] Add lead, review-item, and task assignment to specific teammates.
- [x] Add shared inbox ownership and triage controls.
- [x] Add internal comments on leads and messages distinct from external communications.
- [x] Add first-class task model with due dates and assignees.
- [x] Add SLA timer model and overdue highlighting for lead response and review.
- [x] Build `/app/settings/team` for memberships, roles, and invite status.
- [x] Add property-level permission scoping for larger teams.
- [x] Build `/app/audit` for sensitive-action history and filters.
- [x] Add activity log views by user.

## Phase 23: analytics and reporting expansion

- [x] Build `/app/analytics` with funnel, source, property, and stale-lead views.
- [x] Add inquiry-to-qualified, inquiry-to-tour, and inquiry-to-application funnel charts.
- [x] Add source-quality comparison views across listing channels and campaigns.
- [x] Add rule-friction analytics showing which rules or questions most often block progression.
- [x] Add property-performance comparisons across lead volume, fit rate, and conversion.
- [x] Add team-performance metrics for Org workspaces.
- [x] Add AI-usage analytics showing suggestion volume and acceptance rate.
- [x] Add integration-health analytics for connected systems.
- [x] Add saved report filters and time windows.

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

## Workflow 1: Sign up and create workspace

### Playwright coverage

- [x] Split Workflow 1 coverage out of `scripts/playwright-smoke.mjs` into a dedicated Playwright flow or helper-backed runtime suite.
- [x] Add a Playwright helper for creating a fresh Workflow 1 test user and isolating seeded data assumptions.
- [x] Add a Playwright helper for loading signup pages with query-string variants and asserting preserved params.
- [x] Add a Playwright test for the base `/signup` entry route rendering the expected auth controls and default next-step behavior.
- [x] Add a Playwright test for `/signup?plan=personal` asserting the selected signup intent or visible plan state stays Personal through submission.
- [x] Add a Playwright test for `/signup?plan=org` asserting the selected signup intent or visible plan state stays Org through submission.
- [x] Add a Playwright test for `/signup?source=ai-tool` asserting source attribution survives the signup handoff.
- [x] Add a Playwright test for `/signup?utm_campaign=test` asserting UTM attribution survives the signup handoff.
- [x] Add a Playwright test for `/signup?invite=<token>` asserting invite context is preserved from signup entry into invite acceptance.
- [x] Add a Playwright test for the email-password happy path asserting user creation, successful submit, and redirect to the approved next route.
- [x] Add a Playwright assertion for the email-password happy path that the flow does not dead-end on a blank or incorrect redirect.
- [x] Add a Playwright assertion for the direct-signup happy path that exactly one intended workspace is created for a non-invite account.
- [x] Add a Playwright test for invite-based account creation asserting the flow does not create an unintended extra personal workspace before invite acceptance.
- [x] Add a Playwright test asserting invite-based signup lands on the correct invite continuation route rather than generic app routing.
- [x] Add a Playwright test for invalid email formatting with a visible validation error and blocked submission.
- [x] Add a Playwright test for weak password rejection with the expected error messaging and blocked submission.
- [x] Add a Playwright test for confirm-password mismatch with a visible validation error and blocked submission.
- [x] Add a Playwright test for duplicate-signup handling with the expected recovery path to login or account recovery.
- [x] Add a Playwright test for magic-link request initiation from Workflow 1 entry.
- [x] Add a Playwright test for magic-link verification completion if new-user magic-link signup is enabled. Not applicable in the current environment because magic-link sign-up remains disabled.
- [x] Add a Playwright test for unverified-email resend and verification completion behavior.
- [x] Add a Playwright test for OAuth conflict handling with the expected account-linking or login guidance.
- [x] Add a Playwright test for the signed-out invite page state on `src/app/invite/[token]/page.tsx`.
- [x] Add a Playwright test for the wrong-account invite state on `src/app/invite/[token]/page.tsx`.
- [x] Add a Playwright test for the matching-account invite acceptance state on `src/app/invite/[token]/page.tsx`.
- [x] Add a Playwright test for an already accepted invite on `src/app/invite/[token]/page.tsx`.
- [x] Add a Playwright test for an expired invite on `src/app/invite/[token]/page.tsx`.
- [x] Add a Playwright test for a revoked invite on `src/app/invite/[token]/page.tsx`.
- [x] Add a Playwright mobile-width test for `/signup` ensuring the form remains single-column and fully usable.
- [x] Add a Playwright mobile-width test for `src/app/invite/[token]/page.tsx` ensuring invite copy, actions, and errors remain readable and tappable.
- [x] Add a Playwright mobile-width test for the first onboarding destination after Workflow 1 completion.
- [x] Decide whether Google auth will be fully automated in Playwright or covered only by unit plus manual testing.
- [x] Document the provider rule for Playwright runs: only automate third-party auth providers when the environment supports deterministic mocking or stable test credentials.

### Manual QA checklist

- [ ] Run a desktop manual QA pass for the base `/signup` route and confirm the expected auth methods, copy, and default redirect behavior.
- [ ] Run a desktop manual QA pass for `/signup?plan=personal` and confirm the plan intent shown to the user matches the final bootstrap outcome.
- [ ] Run a desktop manual QA pass for `/signup?plan=org` and confirm the plan intent shown to the user matches the final bootstrap outcome.
- [ ] Run a desktop manual QA pass for `/signup?source=ai-tool` and confirm source attribution is retained after signup.
- [ ] Run a desktop manual QA pass for `/signup?utm_campaign=test` and confirm campaign attribution is retained after signup.
- [ ] Run a desktop manual QA pass for `/signup?invite=<token>` and confirm invite context is preserved into acceptance.
- [ ] Manually verify the direct email-password signup happy path from form completion to the first post-signup route.
- [ ] Manually verify that a direct non-invite signup creates the expected user, workspace, membership, and session records.
- [ ] Manually verify that invite-based signup does not create an unintended extra workspace before invite acceptance.
- [ ] Manually verify that invite acceptance applies the expected membership role and lands in the correct workspace context.
- [ ] Manually verify invalid email handling with clear inline feedback.
- [ ] Manually verify weak password handling with clear inline feedback.
- [ ] Manually verify confirm-password mismatch handling with clear inline feedback.
- [ ] Manually verify duplicate-signup handling and the recovery path back to login or account recovery.
- [ ] Manually verify magic-link issuance from the Workflow 1 entry surface.
- [ ] Manually verify magic-link completion behavior if new-user magic-link signup is enabled.
- [ ] Manually verify Google login behavior and any account-linking recovery guidance.
- [ ] Manually verify the approved verification-gating rule, including resend behavior and final post-verification redirect.
- [ ] Manually inspect the created records for Workflow 1 and confirm user, workspace, membership, session, attribution, and audit-event integrity.
- [ ] Manually verify the signup flow on a mobile viewport for tap target size, readable copy, and single-column layout integrity.
- [ ] Manually verify autofill and password-manager behavior on the signup form.
- [ ] Manually verify social-auth and invite actions remain usable and readable on mobile.
- [ ] Manually verify keyboard-only navigation through signup, invite acceptance, and first redirect.
- [ ] Manually verify visible focus states on all primary Workflow 1 controls.
- [ ] Manually verify form labels, validation text, and auth actions remain understandable for assistive technology users.
- [x] Add a Workflow 1 QA signoff template capturing environment, seed state, auth method, route tested, expected result, actual result, bug links, and whether the scenario is automated in Playwright.

### Workflow testing follow-up

- [ ] Repeat this structure for each major workflow as implementation deepens.
- [ ] Require each workflow backlog section to include dedicated Playwright coverage tasks, mobile tasks, accessibility tasks, and manual QA signoff tasks before the workflow is considered complete.

## Workflow 2: Create first property

### Unit and route coverage

- [x] Extract the Workflow 2 save action out of `src/app/(auth)/onboarding/property/page.tsx` into a testable handler with injectable dependencies.
- [x] Add unit coverage for the required-submit validation rules: property name, property type, location, and rentable room count.
- [ ] Add unit coverage asserting a missing property name returns the approved inline validation message instead of defaulting to a placeholder property.
- [x] Add unit coverage asserting a blank property name blocks submission and preserves entered form values.
- [x] Add unit coverage asserting a blank property type blocks submission and preserves entered form values.
- [x] Add unit coverage asserting a blank location blocks submission and preserves entered form values.
- [x] Add unit coverage asserting rentable room count must be at least 1.
- [x] Add unit coverage asserting shared bathroom count rejects negative values.
- [x] Add unit coverage asserting optional fields can remain blank without blocking creation.
- [x] Add unit coverage asserting the first property create path writes the property to the current workspace only.
- [x] Add unit coverage asserting the first property update path edits the existing onboarding property rather than creating a duplicate.
- [x] Add unit coverage asserting Workflow 2 creates the expected audit event with `property_created` and onboarding metadata.
- [x] Add unit coverage asserting Workflow 2 redirects to `/onboarding/house-rules` only after successful save.
- [x] Add unit coverage asserting failure paths return a stable form-level error instead of throwing away the form state.
- [x] Add unit coverage asserting manager or viewer users without create-property permission are blocked from forcing first-property setup.
- [x] Add unit coverage asserting owner or admin users can complete Workflow 2 when the workspace has no properties.
- [x] Add unit coverage asserting Workflow 2 prepares any draft suggested downstream artifacts required by the spec.

### Playwright coverage

- [x] Split Workflow 2 coverage into a dedicated Playwright flow or helper-backed runtime suite rather than relying on generic smoke coverage.
- [x] Add a Playwright helper for creating a fresh post-Workflow-1 user who has a workspace but no property.
- [x] Add a Playwright test for the base `/onboarding/property` route rendering the expected header, helper copy, step framing, and CTA.
- [x] Add a Playwright test asserting the property name field receives autofocus on first load.
- [x] Add a Playwright test asserting the property type control is visually obvious and constrained to the approved options.
- [x] Add a Playwright test asserting a user can create the first property with only the required Workflow 2 fields.
- [x] Add a Playwright test asserting optional preferences can be filled without blocking save or corrupting required data.
- [x] Add a Playwright test asserting default values are visible and editable for property type and house-preference fields.
- [x] Add a Playwright test for missing-name submission with visible inline validation and blocked redirect.
- [x] Add a Playwright test for missing-property-type submission with visible inline validation and blocked redirect.
- [x] Add a Playwright test for missing-location submission with visible inline validation and blocked redirect.
- [x] Add a Playwright test for zero or invalid rentable-room submission with visible inline validation and blocked redirect.
- [x] Add a Playwright test asserting form values persist after a validation failure.
- [x] Add a Playwright test asserting a successful save routes directly to `/onboarding/house-rules`.
- [x] Add a Playwright assertion that the created property appears in `/app/properties` with the expected summary fields.
- [x] Add a Playwright assertion that a signed-in user with no property sees the expected “create your first property” recovery path from the app.
- [x] Add a Playwright test asserting the first-property flow does not ask for deferred fields such as rent amount, utilities, photos, or compliance details.
- [x] Add a Playwright mobile-width test for `/onboarding/property` ensuring a single-column layout, readable copy, and tappable controls.
- [x] Add a Playwright mobile-width test asserting property-type selection cards or controls remain usable and readable on small screens.
- [ ] Add a Playwright keyboard-navigation test covering all Workflow 2 controls from first focus through submit.

### Manual QA checklist

- [ ] Run a desktop manual QA pass for `/onboarding/property` and confirm the page framing matches Workflow 2 rather than generic CRUD.
- [ ] Manually verify the required-fields-only happy path from property entry to `/onboarding/house-rules`.
- [ ] Manually verify the created property belongs to the correct workspace and becomes the active onboarding property.
- [ ] Manually verify the property name copy, examples, and helper text feel operational rather than enterprise or abstract.
- [ ] Manually verify property type choices are understandable to shared-housing operators.
- [ ] Manually verify missing-name handling with clear inline feedback.
- [ ] Manually verify missing-property-type handling with clear inline feedback.
- [ ] Manually verify missing-location handling with clear inline feedback.
- [ ] Manually verify invalid rentable-room counts with clear inline feedback.
- [ ] Manually verify optional preferences are low-pressure, clearly labeled, and editable.
- [ ] Manually inspect created records for property data integrity, audit logging, and suggested downstream setup artifacts.
- [ ] Manually verify the flow on a mobile viewport for stacked layout, readable copy, and comfortable tap targets.
- [ ] Manually verify keyboard-only navigation, focus visibility, and label clarity for assistive technology users.
- [x] Add a Workflow 2 QA signoff section or template capturing environment, route tested, property fixture, expected result, actual result, data checks, and bugs.

### Workflow testing follow-up

- [x] Decide whether Workflow 2 should be added to the existing dedicated onboarding runtime suite or moved into its own dedicated `test:workflow2` script.
- [ ] Require Workflow 2 completion to include passing unit coverage, passing Playwright coverage, and manual QA signoff before the workflow is marked complete.

## Workflow 3: Define house rules

### Product and data model alignment

- [x] Confirm the approved Workflow 3 v1 category set and map it to normalized stored values: smoking, pets, guests, bathroom sharing, parking, minimum stay, quiet hours or noise, furnishing, and custom lifestyle expectations.
- [x] Add any missing `RuleCategory` enum values required by Workflow 3 so the persisted model can represent the approved onboarding categories without collapsing them into generic strings.
- [x] Add a normalized stored-value field to `PropertyRule` so structured choices like `outside_only`, `limited_overnight`, or `three_months_plus` can be persisted separately from the display label.
- [ ] Add any creator or metadata fields needed for custom rules if Workflow 3 requires distinguishing generated defaults from user-entered expectations.
- [x] Create a Prisma migration for the Workflow 3 rule-shape changes.
- [x] Run `npm run db:generate` after the schema change so generated Prisma types stay aligned before typecheck and tests.
- [x] Preserve compatibility with existing rule evaluation and property-rules pages while introducing the normalized Workflow 3 rule structure.

### Onboarding flow restructuring

- [x] Expand the onboarding sequence to include Workflow 4 after Workflow 3 instead of ending onboarding at channels.
- [x] Add `/onboarding/questions` as the next required onboarding route after house-rule setup.
- [x] Update onboarding navigation and step-completion state so Workflow 3 completion is based on a meaningful saved ruleset, not only the presence of any rule row.
- [x] Update Workflow 3 save behavior so successful completion routes to `/onboarding/questions` instead of `/onboarding/channels`.
- [x] Add a Back action from `/onboarding/house-rules` to `/onboarding/property`.
- [x] Update page framing copy so Workflow 3 uses the approved practical/shared-housing language: title, helper copy, and severity guidance.

### House-rules onboarding UX

- [x] Replace the current checkbox-preset onboarding UI with guided rule cards or an equivalent structured onboarding flow instead of a flat preset list.
- [x] Add a suggested-rules section that preloads conservative defaults based on property type and shared-living setup from Workflow 2.
- [x] Ensure suggested rules are editable and removable rather than silently auto-applied.
- [x] Add structured value controls for each supported category using radio cards, segmented controls, or compact selects as appropriate.
- [x] Add explicit severity controls for each enabled structured rule with human-readable descriptions for blocking, warning, and informational behavior.
- [x] Add an additional-expectations or custom-rules section with title, description, and severity fields.
- [x] Allow disabling or removing individual structured rules without deleting the whole rule set.
- [x] Add a real-time ruleset summary showing blocking, warning, and informational counts before save.
- [x] Show a low-pressure nudge when the user has not added any rules yet instead of treating the page like a hard validation wall without explanation.
- [x] Keep the page mobile-friendly with stacked cards, readable controls, and CTA placement that works on narrow screens.

### Save behavior and downstream setup

- [x] Extract the Workflow 3 save action from `src/app/(auth)/onboarding/house-rules/page.tsx` into a dedicated testable handler with injectable dependencies.
- [x] Persist structured rules with category, normalized selected value, severity or mode metadata, and active state.
- [x] Persist custom rules separately using the same rule model without forcing them into misleading preset categories.
- [ ] Stop deleting and recreating every rule on each save if that would lose metadata or make later edits harder to reason about.
- [x] Create an explicit audit event for Workflow 3 completion and include summary counts for blocking, warning, and informational rules.
- [ ] Create per-rule analytics or audit hooks for add, remove, and update actions where practical.
- [x] Prepare or generate the suggested qualification-question payload needed for the next onboarding step after rules are saved.
- [x] Revalidate the onboarding hub, property rules view, and questions setup view after Workflow 3 changes are saved.

### Unit coverage

- [x] Add unit coverage for the extracted Workflow 3 save handler using node:test.
- [x] Add unit coverage for mapping each structured Workflow 3 category option into the normalized stored rule value.
- [x] Add unit coverage for severity mapping so blocking, warning, and informational selections persist with the correct `mode`, `severity`, `warningOnly`, and `autoDecline` semantics.
- [x] Add unit coverage asserting suggested defaults vary appropriately by property type where Workflow 2 data supports that behavior.
- [ ] Add unit coverage asserting users can remove or disable a suggested rule before saving.
- [x] Add unit coverage asserting at least one meaningful rule or an explicit continue-anyway path is required by the chosen product behavior.
- [x] Add unit coverage asserting an incomplete custom rule returns a stable validation error and preserves entered form state.
- [x] Add unit coverage asserting successful Workflow 3 save redirects to `/onboarding/questions` only after persistence succeeds.
- [x] Add unit coverage asserting Workflow 3 writes the expected audit event and any downstream question-suggestion artifacts.
- [ ] Add unit coverage asserting existing property rules are updated in a stable way instead of creating unusable duplicates.

### Playwright coverage

- [x] Extend dedicated onboarding Playwright coverage to include Workflow 3 rather than relying on generic smoke coverage.
- [x] Add a Playwright scenario for a fresh post-Workflow-2 user landing on `/onboarding/house-rules` with the expected step framing and helper copy.
- [x] Add a Playwright test asserting suggested rules render based on the saved property profile and are clearly editable.
- [x] Add a Playwright test covering the happy path where the user accepts or edits suggested rules and continues to `/onboarding/questions`.
- [x] Add a Playwright test covering a custom rule create flow with title, description, and severity.
- [x] Add a Playwright test asserting a custom rule with a missing title or severity shows visible validation and blocks save.
- [x] Add a Playwright test asserting changing severity updates the ruleset summary counts before submit.
- [x] Add a Playwright test asserting a user can remove a suggested rule before save without breaking the rest of the form.
- [x] Add a Playwright test asserting the page no longer routes directly from Workflow 3 to channels.
- [x] Add a Playwright assertion that saved rules appear correctly on `/app/properties/[propertyId]/rules` after onboarding.
- [x] Add a Playwright mobile-width test for Workflow 3 ensuring structured rule cards remain readable and tappable on small screens.
- [ ] Add a Playwright keyboard-navigation test covering toggles, radio groups, severity controls, custom-rule inputs, and submit.

### Manual QA checklist

- [ ] Run a desktop manual QA pass for `/onboarding/house-rules` and confirm the page feels practical and shared-housing-specific rather than like a generic policy form.
- [ ] Manually verify suggested rules match the current property profile closely enough to reduce blank-page stress without feeling rigid.
- [ ] Manually verify each structured category is understandable, editable, and not overloaded with legal or technical language.
- [ ] Manually verify blocking, warning, and informational language is understandable without reading developer-facing terminology.
- [ ] Manually verify the summary panel accurately reflects the current rule configuration before save.
- [ ] Manually verify custom rule creation, editing, and removal with realistic house expectations.
- [ ] Manually verify the save path lands on `/onboarding/questions` and leaves onboarding state consistent.
- [ ] Manually inspect persisted rules for normalized selected values, severity metadata, and correct property association.
- [ ] Manually verify the app-level property rules page still presents saved rules clearly after Workflow 3 changes.
- [ ] Manually verify Workflow 3 on a mobile viewport for stacked layout, readable copy, and comfortable tap targets.
- [ ] Manually verify keyboard-only navigation, focus visibility, group labeling, and screen-reader-friendly error messaging.
- [x] Add a Workflow 3 QA signoff template capturing property fixture, rule mix, severity mix, expected route transition, actual persisted data, and bugs.

### Workflow testing follow-up

- [x] Decide whether Workflow 3 should live inside the existing onboarding runtime suite or ship with a dedicated `test:workflow3` command.
- [ ] Require Workflow 3 completion to include passing unit coverage, passing Playwright coverage, and manual QA signoff before the workflow is marked complete.
