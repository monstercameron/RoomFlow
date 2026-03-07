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
- [ ] Add core UI primitives:
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
- [ ] Decide early whether `room` is a real v1 model or explicitly deferred
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
- [ ] Defer team management until after single-user flow works

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
- [ ] Defer full analytics until the event model is stable

## Phase 11: settings and integrations

- [x] Build `/app/settings`
- [x] Add minimal profile/account settings
- [x] Build `/app/settings/integrations` for:
  * inbound email setup placeholder
  * SMS provider setup
  * webhook endpoint display
  * CSV import placeholder
- [ ] Defer `/app/settings/billing` until pricing and plan logic are real

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
