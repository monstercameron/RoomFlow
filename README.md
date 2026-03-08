# Roomflow

Roomflow is a workflow and qualification system for shared-housing leads.

Listing sites are good at generating attention. They are not good at the operational work that happens after a prospect says they are interested. Roomflow is built for that gap: intake, qualification, house-rule fit, follow-up, routing, and operator visibility.

It is designed for room-rental and shared-housing operators who need more than a generic CRM, but do not want a bloated property management platform.

## The Problem

Shared-housing operators usually deal with the same failure pattern:

- leads arrive from multiple channels with inconsistent information
- operators ask the same questions over and over
- fit against house rules is checked too late
- good leads get buried in inbox noise
- weak leads still consume tour time
- decisions are made without a clear audit trail

The result is slow follow-up, wasted tours, and a qualification process that depends too heavily on memory and manual discipline.

## The Thesis

The biggest workflow problem in shared housing happens before the application.

For room rentals, success depends on answering questions like:

- Is the lead serious?
- Does this person fit the house rules?
- What is still missing before a tour?
- Who on the team owns the next step?
- Why was this lead advanced, held, or declined?

Roomflow is built around the idea that shared-housing qualification is its own category of operations software.

## What Roomflow Is

Roomflow is:

- a lead intake and qualification layer
- a CRM for room-rental and shared-housing inquiries
- a house-rules-aware routing system
- a workflow tool for next-step decisions
- an operational record for conversations, tasks, and audit events

Roomflow is not:

- a listing marketplace
- a traffic-generation engine
- a rent collection tool
- a full property management suite
- a black-box decision engine making final housing judgments

The operator stays in control. Roomflow helps enforce consistency and visibility.

## How It Works

The intended workflow is straightforward:

1. A lead arrives from email, SMS, manual entry, CSV import, or another inbound source.
2. The inquiry is normalized into a common lead record.
3. Missing qualification details are collected.
4. Answers are checked against property-specific questions and house rules.
5. The lead is routed to a clear next step.
6. The team works from a shared dashboard, inbox, task list, and audit trail.

That next step may be:

- request more info
- hold under review
- qualify
- schedule a tour
- send an application
- decline

## Why Shared Housing Is Different

Whole-unit leasing and room rentals do not behave the same way operationally.

Shared housing introduces constraints that often matter before any formal application starts, including:

- smoking rules
- pet rules
- overnight guest expectations
- quiet hours
- bathroom-sharing expectations
- parking constraints
- minimum stay preferences
- general household compatibility

Those constraints shape the lead workflow early. Roomflow is built to make them visible, structured, and repeatable.

## Core Concepts

### Lead normalization

Inbound messages are inconsistent. Roomflow normalizes the basics:

- full name
- email and phone
- source channel
- move-in timing
- budget
- stay length
- work status
- notes and answer metadata

### Qualification workflows

Each property can define the questions required before moving forward.

Examples include:

- move-in date
- budget
- lease length
- smoking
- pets
- parking needs
- work schedule
- bathroom-sharing expectations
- house-rule acknowledgment

### House-rule fit

Roomflow supports fit outcomes like pass, caution, mismatch, and under review so operators can distinguish between a strong lead, a weak lead, and a lead that needs human judgment.

### Routing and visibility

The goal is that no lead just sits in a message thread. Every lead should have a visible status, a next step, and a reason.

### Auditability

Operators need to know what happened, when it happened, and why. That includes questions asked, answers received, status changes, overrides, manual actions, and sensitive workflow events.

## Who It Is For

Roomflow is aimed at:

- owner-occupant landlords renting rooms
- house hackers
- small co-living operators
- shared-housing property managers
- small teams coordinating lead follow-through across multiple properties

The best-fit user already has inbound demand, but lacks a consistent operational system to qualify and route that demand.

## Current Product Surface

This repo now includes working surfaces across the funnel, including:

- public marketing and acquisition pages
- login, signup, and workspace bootstrap
- onboarding for property and house-rule setup
- dashboard, leads, lead detail, inbox, properties, templates, and calendar
- workflow builder foundations
- integrations hub foundations
- org collaboration features like teammates, ownership, tasks, property scopes, and SLA settings
- analytics for funnel performance, source quality, rule friction, stale leads, team metrics, AI usage, and integration health

For implementation history and execution phases, see [TODO.md](./TODO.md).

## Positioning

The simplest way to describe Roomflow is:

**Listing sites generate the lead. Roomflow qualifies and routes the lead.**

Or, slightly longer:

Roomflow helps shared-housing operators capture inquiries, ask consistent questions, evaluate fit against house rules, and move only the right prospects into tours or applications.

## Local Development

### Requirements

- Node.js 22+
- npm

### Install

```bash
npm install
```

### Environment

If needed, copy the env template first:

```bash
copy .env.example .env
```

### Start the app locally

Run the following in order:

```bash
npm run db:start
npm run db:push
npm run db:seed:test-user
npm run dev -- --hostname 127.0.0.1 --port 3001
```

The expected local database path uses the bundled PGlite-backed process on `127.0.0.1:5432`.

If the local database state becomes stale, the usual reset path is:

1. stop local Node processes using the app or local DB
2. remove `.local_pg`
3. rerun `npm run db:start`
4. rerun `npm run db:push`
5. rerun `npm run db:seed:test-user`

### Local login

- email: `test@roomflow.local`
- password: `Roomflow123!`

### Useful commands

```bash
npm test
npm run typecheck
npm run lint
npm run db:generate
npm run db:studio
npm run worker
```

## Optional Auth Providers

If you want to test linked social accounts from the security settings flow, configure any provider you need:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`
- `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`

Providers without valid credentials remain unavailable in the app.

## OpenAI Realtime Smoke Test

Roomflow includes a small server-side smoke path for OpenAI Realtime.

1. add `OPENAI_API_KEY` to your env
2. run:

```bash
npm run openai:realtime:smoke -- "Draft a short, friendly follow-up to a shared-housing lead."
```

This path uses a backend WebSocket flow for text output and is intended as a smoke test rather than a full production voice client.

## Repo Orientation

Important top-level areas:

- `src/app` for App Router pages and routes
- `src/lib` for auth, workflow, integrations, analytics, and business logic
- `src/components` for UI and shared components
- `prisma` for schema and migrations
- `scripts` for local setup, worker scripts, and smoke tooling
- `reference` for planning and product docs

## Principles

The product still follows the same underlying principles:

- narrow over broad
- ops first
- shared-house aware
- transparent workflow over hidden automation
- human-in-the-loop decision making
# Roomflow

Roomflow is an operations layer for shared-housing and room-rental leads.

It sits between the first inbound inquiry and the formal application process. Instead of competing with listing sites for traffic, Roomflow takes the messy work that happens after a prospect shows interest: collecting missing details, checking fit against house rules, routing the lead to the next step, and keeping a usable audit trail for the operator.

## What This Repo Is

This repository contains the current Roomflow application built with Next.js, Prisma, Better Auth, and a Prisma-backed local workflow stack.

The product already includes the main operating surfaces for:

- marketing and acquisition pages
- auth and workspace bootstrap
- onboarding and property setup
- lead intake, qualification, and routing
- inbox, templates, workflows, and audit history
- org collaboration, tasks, and ownership
- integration foundations and analytics reporting

Roomflow is intentionally narrow in product thesis even as the codebase expands: it is focused on the shared-housing lead workflow, not a general-purpose property management suite.

## Product Thesis

Shared housing has a qualification problem before it has an application problem.

Operators are often dealing with:

- repeated "is this still available?" messages
- incomplete prospect information
- inconsistent questions across channels
- late discovery of house-rule conflicts
- wasted tours
- fragmented conversations across email, SMS, social, and listing platforms

Roomflow exists to make that pre-application workflow consistent.

## What Roomflow Does

Roomflow is:

- a lead intake and qualification layer
- a shared-housing CRM
- a house-rules-aware workflow system
- a routing engine for next-step decisions
- a unified operational surface for leads, messaging, tasks, and audit history

Roomflow is not:

- a listing marketplace
- a traffic-generation platform
- a rent collection tool
- a full property management system
- a black-box approval engine making final housing decisions

The operator stays in control. The system helps enforce process, not replace judgment.

## Core Workflow

Without Roomflow, operators usually reply manually, ask the same questions repeatedly, track answers in scattered threads, and lose confidence in who is worth advancing.

With Roomflow, the intended flow is:

1. A lead arrives from a listing source, manual entry, email, SMS, CSV import, or webhook.
2. The inquiry is normalized into a common lead record.
3. Missing qualification information is requested.
4. Answers are checked against property-specific questions and house rules.
5. The lead is routed into a clear next step.
6. The operator works from a consistent dashboard, inbox, task list, and audit trail.

## Key Concepts

### Lead normalization

Inbound inquiries are inconsistent. Roomflow normalizes core information like:

- full name
- email and phone
- source channel
- move-in timing
- budget
- stay length
- work status
- notes and answer metadata

### Qualification workflows

Each property can define a question set for the information the operator needs before moving forward.

Examples include:

- move-in date
- budget
- lease length
- smoking
- pets
- overnight guests
- parking needs
- work schedule
- bathroom-sharing expectations
- house-rule acknowledgments

### House-rule fit

Shared housing has operational constraints that whole-unit leasing often does not. Roomflow supports property-specific rules and fit outcomes such as pass, caution, mismatch, and under review.

### Routing and next steps

Every lead should land in a concrete operational state instead of floating in message history.

Examples include:

- new
- awaiting response
- incomplete
- under review
- qualified
- caution
- tour scheduled
- application sent
- declined
- closed or archived

### Auditability

Operators need to know what was asked, what was answered, why a lead was advanced, and when sensitive actions happened. Roomflow keeps that history visible and structured.

## Target Users

Roomflow is aimed at:

- owner-occupant landlords renting rooms
- house hackers
- small co-living operators
- shared-housing property managers
- small teams coordinating lead follow-through across multiple properties

The best fit is an operator who already gets inbound demand, but needs a better system for qualification and follow-through.

## Current Product Surface

The current app includes major slices across the funnel:

- public marketing and acquisition pages
- login, signup, and workspace bootstrap
- onboarding for property and house-rule setup
- dashboard, lead list, lead detail, inbox, properties, templates, and calendar
- workflow builder foundations
- integrations hub foundations
- org collaboration features such as teammate membership, ownership, tasks, property scopes, and SLA settings
- analytics and reporting for funnels, sources, rule friction, stale leads, team metrics, AI usage, and integration health

For the execution roadmap and phase history, see [TODO.md](./TODO.md).

## Stack

- Next.js App Router
- TypeScript
- Prisma
- Better Auth
- React 19
- Tailwind CSS 4
- pg-boss for background jobs
- PGlite and Postgres-compatible local workflow support

## Local Development

### Requirements

- Node.js 22+
- npm

### Install

```bash
npm install
```

### Environment

Copy your env file first if needed:

```bash
copy .env.example .env
```

### Start the local database and app

Run the following in order:

```bash
npm run db:start
npm run db:push
npm run db:seed:test-user
npm run dev -- --hostname 127.0.0.1 --port 3001
```

The expected local database path uses the bundled PGlite-backed process on `127.0.0.1:5432`.

If the local database state becomes stale, the usual recovery path is:

1. stop local Node processes using the app or local DB
2. remove `.local_pg`
3. rerun `npm run db:start`
4. rerun `npm run db:push`
5. rerun `npm run db:seed:test-user`

### Local login

- email: `test@roomflow.local`
- password: `Roomflow123!`

### Useful commands

```bash
npm test
npm run typecheck
npm run lint
npm run db:generate
npm run db:studio
npm run worker
```

## Optional Auth Providers

If you want to test linked social accounts from the security settings flow, configure any provider you need:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`
- `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`

Providers without valid credentials remain unavailable in the app.

## OpenAI Realtime Smoke Test

Roomflow includes a small server-side smoke path for OpenAI Realtime.

1. add `OPENAI_API_KEY` to your env
2. run:

```bash
npm run openai:realtime:smoke -- "Draft a short, friendly follow-up to a shared-housing lead."
```

This path uses a backend WebSocket flow for text output and is intended as a smoke test, not a full production voice client.

## Repo Orientation

Important top-level areas:

- `src/app` for App Router pages and routes
- `src/lib` for workflow, auth, integrations, analytics, and server-side business logic
- `src/components` for UI and shared surface components
- `prisma` for schema and migrations
- `scripts` for local setup, workers, and smoke tooling
- `reference` for planning and product docs

## Principles

The repo still follows the same product principles the original draft was aiming at:

- narrow over broad
- ops first
- shared-house aware
- transparent workflow over hidden automation
- human-in-the-loop decision making

## Short Version

Listing sites generate attention.

Roomflow qualifies, routes, documents, and follows through on the lead.
* message templates
* audit log

### Later additions

* per-room inventory routing
* waitlists
* multilingual support
* voice call transcript ingestion
* integrations with application/screening providers
* resident onboarding and house-rule acknowledgment
* analytics on lead quality and conversion

---

## Non-goals for v1

To avoid losing focus, v1 should not include:

* marketplace listings
* payments
* lease generation
* maintenance management
* rent collection
* accounting
* advanced tenant scoring
* full roommate matching marketplace logic

---

## Example positioning

### Short version

Roomflow is a CRM and qualification workflow for room-rental landlords.

### Slightly longer version

Roomflow helps landlords and co-living operators capture inquiries from listing sites, qualify them against house rules, and route only strong-fit prospects to tours or applications.

---

## Why this matters

The room-rental and shared-housing world still relies heavily on:

* scattered messages
* ad hoc screening
* manual follow-up
* vague fit checks
* repetitive conversations

Roomflow exists to turn that chaos into a **repeatable operating workflow**.

---

## v1 success criteria

Roomflow is successful if it can:

* reduce the number of manual back-and-forth messages per lead
* reduce wasted tours
* improve inquiry-to-qualified-lead conversion
* give operators a clear view of lead status
* make house-rule fit visible early in the funnel

---

## Future direction

Once the core qualification workflow is solid, Roomflow can expand into:

* room-by-room routing across properties
* resident onboarding workflows
* house-rules acknowledgment and enforcement records
* shared-house operational coordination
* portfolio-level lead intelligence

The long-term vision is a focused operating system for **shared-housing intake and qualification**, not a generic property management suite.
#   R o o m F l o w 
 
 