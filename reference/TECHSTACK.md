For this product, pick JavaScript, not Go.

Go is excellent for services, but for a shared-housing qualification product with dashboards, auth, messaging, admin screens, forms, and fast iteration, JavaScript gives you the better overall trade: higher velocity, fewer integration seams, and simpler full-stack debugging.

## Recommendation

### Core v1 stack

* Frontend + app server: Next.js on Node.js
* Database: PostgreSQL
* Auth: Better Auth
* ORM / DB layer: Prisma
* Validation + forms: Zod + React Hook Form
* Outbound email: Resend
* SMS + phone messaging: Twilio
* Background jobs + scheduling: pg-boss
* Scheduling handoff: Cal.com or a simple booking-link integration
* Infra: Docker Compose on a Linux VM, behind Caddy
* Observability: OpenTelemetry + structured JSON logs

This is still the highest-DX, lowest-friction stack for what the README describes, but it needs more than just Next.js + Postgres. The product is not only a CRUD dashboard. It also needs inbound lead capture, multi-channel messaging, automated follow-up, qualification state transitions, audit logging, and scheduling handoff.

## What the README requires

The README describes an MVP with:

* unified lead inbox
* source tracking
* structured intake questionnaire
* property-specific rule sets
* automated follow-up for missing answers
* lead status board
* qualification summary
* scheduling handoff
* message templates
* audit log

That means the stack must support five real capabilities on day 1:

* channel ingestion
* async job processing
* conversation history
* rule evaluation and routing
* audit-safe event storage

The earlier draft covered the web app and database well enough, but it did not fully cover those workflow pieces.

## Exact stack I'd use

### 1) App framework

**Next.js**

Why:

* one codebase for pages, forms, dashboards, APIs, and server-side logic
* easy self-hosting on Node or Docker
* good fit for admin-heavy B2B SaaS
* easy to keep as a monolith first

Use it as a monolith first. Do not split frontend and backend on day one.

### 2) Runtime

**Node.js** in production

Use the boring runtime. Low maintenance matters more than marginal runtime novelty for this product.

### 3) Database

**PostgreSQL**

Best default for this app:

* relational data
* filtering and search
* workflows
* audit trails
* reporting
* future analytics

Postgres is the right home for leads, properties, rooms, conversations, messages, qualification answers, status changes, and event history.

### 4) DB access

**Prisma**

Why:

* strong schema workflow
* migrations
* fast scaffolding
* easy local development

Prisma is a good fit as long as you keep the schema disciplined and do not hide business logic in the ORM layer.

### 5) Auth

**Better Auth**

Why:

* good fit for a monolithic Next app
* supports standard SaaS auth flows
* can grow into teams and role-based access later

You will likely need:

* owner accounts
* portfolio or team access
* manager or staff roles later

### 6) Forms and validation

**Zod + React Hook Form**

This is needed because the README assumes a structured intake questionnaire and property-specific qualification questions. You want one shared validation model for:

* intake forms
* admin rule configuration
* message template variables
* API payload validation

### 7) Messaging

**Resend for outbound email**

Use it for:

* verification
* inquiry follow-ups
* tour confirmations
* application invites
* notifications

**Twilio for SMS**

Use it for:

* inbound SMS capture
* outbound follow-ups
* reminder sequences
* basic two-way messaging

The product in the README is a workflow layer around fragmented channels. If you do not choose real messaging providers up front, you do not actually have the inbox or follow-up system the product description assumes.

### 8) Inbound lead capture and channel strategy

Do **not** promise native integrations for every listing site in v1.

The README names Facebook, Roomster, SpareRoom, Zillow, Craigslist, SMS, and email as lead sources. For v1, split them into two groups:

* directly supported channels: web forms, manual lead entry, inbound email, inbound SMS
* source-tagged/manual-import channels: Facebook, Roomster, SpareRoom, Zillow, Craigslist

That keeps scope realistic while still satisfying the product need for source tracking and normalization.

Technically, this means you need:

* webhook endpoints for inbound messaging
* source tagging on every lead
* a normalization layer that maps inbound payloads into one internal lead/message schema
* an append-only event trail for imports, replies, status changes, and rule results

### 9) Background jobs and scheduling

**pg-boss**

This was the biggest missing piece in the earlier draft.

You need a real job system for:

* delayed follow-up messages
* retryable outbound sends
* reminder sequences
* webhook fan-out
* nightly cleanup or reconciliation jobs
* future digest notifications

Use a Postgres-backed queue first. It keeps v1 simple:

* one database
* one deploy shape
* no Redis requirement on day 1

If the queue volume becomes painful later, then add Redis and a separate worker tier.

### 10) Scheduling handoff

**Cal.com or a simple booking-link integration**

The README calls out scheduling handoff, not a full calendar product. Do not build custom scheduling logic first.

For v1, you need:

* a configurable scheduling link per property or operator
* the ability to trigger that link only for qualified leads
* an audit event showing when the invite was sent

That is enough to satisfy the product flow without inventing a calendar engine.

### 11) Search and inbox support

Use **Postgres full-text search + pg_trgm** for inbox and lead lookup.

The README assumes:

* unified inbox
* source tracking
* qualification status
* message history

That usually means operators need to search by:

* name
* phone
* email
* source
* property
* message text

Do that in Postgres first. Do not add Elasticsearch on day 1.

### 12) Message templates

Use database-backed templates with variable interpolation.

You need templates for:

* missing info follow-up
* rule mismatch decline
* scheduling invite
* application handoff

Keep the renderer simple. Store templates in Postgres, render on the server, and log the rendered output that was actually sent.

### 13) Audit trail and workflow events

This cannot be an afterthought.

The README explicitly calls for an audit log and decision history. Model this with explicit event records such as:

* lead.created
* lead.normalized
* message.received
* message.sent
* qualification.answer_recorded
* qualification.rule_matched
* qualification.rule_failed
* lead.status_changed
* scheduling.invite_sent
* application.invite_sent

Use append-only event storage for auditability. You can still keep current-state tables for fast reads, but the event log needs to exist.

### 14) Observability

**OpenTelemetry + structured logs**

Track:

* webhook failures
* outbound message failures
* queue latency
* job retry counts
* auth failures
* lead-to-qualified conversion events

This product is workflow-heavy. Silent automation failures will hurt you more than raw page-load latency.

### 15) Deployment

**Docker Compose + Caddy**

This is the easiest Linux VM path:

* `app`
* `postgres`
* optional `worker` process running from the same codebase
* reverse proxy in front

You can run the app and worker from the same monorepo and the same image if needed. The important part is that queued work is not tied only to web request lifecycles.

## Minimum internal modules

If you want the implementation to match the README, the codebase needs these modules even if they all live inside one Next app:

* auth and user management
* properties and rooms
* lead intake
* conversation inbox
* message delivery adapters
* qualification questionnaire
* property rule engine
* workflow routing
* template management
* scheduling handoff
* audit/event log
* reporting basics

That is the real v1 surface area.

## Minimum data model

At a minimum, plan for tables or equivalent models around:

* users
* organizations or operators
* properties
* rooms
* lead_sources
* leads
* contacts
* conversations
* messages
* qualification_question_sets
* qualification_answers
* property_rules
* lead_status_history
* message_templates
* scheduled_jobs
* audit_events

Without this level of structure, the product collapses into an inbox plus notes, which is weaker than the README promises.

## Best architecture for v1

Keep it boring:

* Next.js app
* Node runtime
* Postgres
* Prisma
* Better Auth
* Zod + React Hook Form
* Resend
* Twilio
* pg-boss
* Cal.com link handoff
* Docker Compose
* Caddy

That gets you:

* one repo
* one main app
* one database
* direct support for email and SMS
* async follow-up automation
* explicit auditability
* realistic Linux hosting
* a clean path to future scale

## What to avoid on day 1

* separate frontend and backend repos
* Go backend + JS frontend
* microservices
* Redis before you need it
* custom calendar scheduling
* bespoke rules DSL
* Elasticsearch
* Kubernetes
* native integrations for every listing marketplace

All of that slows you down without improving the actual qualification workflow.

## How it scales later

This stack scales cleanly in stages.

### Stage 1

Single VM:

* Caddy
* Next app
* worker process
* Postgres

### Stage 2

Add only if needed:

* Redis
* dedicated worker containers
* object storage for attachments
* separate read-heavy endpoints
* better analytics pipeline

### Stage 3

Split only what hurts:

* worker service
* webhook ingestion service
* search or indexing service

You do not need Go to reach a solid SaaS business for this product.

## Blunt answer

Choose JavaScript.

And specifically:

**Next.js + Node + Postgres + Prisma + Better Auth + Zod + React Hook Form + Resend + Twilio + pg-boss + Cal.com handoff + Docker Compose + Caddy**

That is the stack I would bet on for:

* fastest shipping
* lowest friction on Linux
* easiest debugging
* realistic messaging support
* easiest AI-assisted development
* lowest maintenance for a solo founder
