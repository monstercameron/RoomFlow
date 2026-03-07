# Roomflow — Platform Feature Specification

This document is the consolidated product specification for Roomflow.

It defines the major feature areas of the platform, what each feature is for, how it should work, where it appears in the product, and what boundaries or constraints apply.

This is intended to act as the top-level source of truth for the platform.

---

# 1. Product definition

Roomflow is an AI-powered workflow platform for room-rental and shared-housing operations.

Its main job is to help operators:

* capture inquiries from multiple sources
* communicate with prospects across channels
* qualify leads against property-specific house rules
* organize the lead funnel
* route leads to the right next step
* coordinate tours, screening, and application invites
* run solo or team workflows from one system

Roomflow is not a generic property management suite.
It is primarily a lead intake, communications, qualification, automation, and integration platform.

---

# 2. Platform principles

## 2.1 Workflow first

The product should optimize operational workflow, not just data storage.

## 2.2 AI is built in

AI is a platform capability, not an afterthought.

## 2.3 Shared-housing specific

Features should reflect room-rental realities such as house rules, shared bathrooms, guest expectations, and move-in fit.

## 2.4 One lead record

Every prospect should resolve into one canonical lead record with source history and activity history.

## 2.5 Human-in-the-loop

Automation should assist the operator, not replace judgment in high-risk decisions.

## 2.6 Integrations are first-class

External systems should feel like connected modules, not bolt-ons.

---

# 3. Core platform modules

The platform is composed of these top-level modules:

* Auth and identity
* Workspaces and plans
* Properties and listings
* Leads and qualification workflow
* Communications
* AI features
* Workflow automation
* Scheduling
* Screening and verification
* Integrations
* Portals and external-facing flows
* Org and team collaboration
* Analytics and reporting
* Billing and monetization
* Trust, safety, and compliance

---

# 4. Auth and identity

## 4.1 Purpose

Allow users to sign up, log in, recover access, and join workspaces using modern authentication methods.

## 4.2 Features

* Email + password
* Magic link login
* Google login
* Facebook / Meta login
* Microsoft login
* Apple login
* Passkeys
* Account linking
* Email verification
* Password reset
* Session/device management
* Workspace invite acceptance
* Workspace switching

## 4.3 How it should work

### Email + password

Users can create a standard account with name, email, and password.
Email verification is required unless a trusted identity provider confirms a verified email.
Password reset is available from the login page.

### Magic link

Users can request a one-time sign-in link by email.
The link expires after a defined period and is invalid after first use.
Magic link should work both for login and lightweight recovery.

### Google login

Users can create or access an account using Google identity.
If an account already exists with the same verified email, the system should offer linking instead of creating a duplicate.

### Facebook / Meta login

Users can sign up and log in with Facebook identity.
This is especially useful for users operating in Meta-heavy channels.

### Microsoft login

Useful for Org customers using Microsoft 365.
Should link cleanly with existing accounts.

### Apple login

Should support Apple identity and private relay email handling.

### Passkeys

Users can register passkeys for passwordless secure login.
Passkeys should be optional and coexist with other auth methods.

### Account linking

A user should be able to attach multiple auth methods to one identity.
Account linking requires verified ownership and should never silently merge unrelated accounts.

### Invites and workspace switching

Org members should be able to receive email invites, accept them, and join a workspace using an existing or new account.
Users with access to multiple workspaces should be able to switch between them.

---

# 5. Workspaces and plans

## 5.1 Purpose

Support both solo users and organizations under a clear plan structure.

## 5.2 Plans

* Personal
* Org

## 5.3 Personal

For solo operators.
Includes a complete core product with AI.
Limited to one user and a smaller property footprint.

## 5.4 Org

For teams, portfolios, and businesses.
Includes everything in Personal plus team workflows, advanced integrations, and higher AI/automation depth.

## 5.5 How it should work

Each workspace has:

* plan type
* active subscription state
* usage counters
* enabled capabilities
* billing owner

Users belong to one or more workspaces.
A user’s role and permissions are determined by workspace membership, not login method.

Upgrade prompts should appear when a Personal user attempts Org-only actions such as inviting teammates or connecting advanced integrations.

Downgrades must preserve data and disable unsupported features safely rather than deleting anything.

---

# 6. Properties and listings

## 6.1 Purpose

Represent shared houses, room-rental locations, and listing context for qualification workflows.

## 6.2 Features

* Property records
* Property-level settings
* House rules
* Qualification question sets
* Listing source metadata
* Listing optimization tools
* Listing sync status
* Listing performance analytics

## 6.3 How it should work

Each property should have:

* property name
* address or general location
* rentable room count
* shared bathroom count
* parking availability
* amenity notes
* active status
* house rules
* question set
* channel preferences
* calendar target

Property rules and question sets determine how leads are qualified for that property.
A property can optionally be linked to listing sources or external feeds.

Listing optimization tools should analyze listing clarity, missing details, and expectation mismatches and propose improvements.

Listing sync status should show whether a listing connection is healthy, pending, failed, or out of date.

---

# 7. Leads and qualification workflow

## 7.1 Purpose

Manage prospect intake and convert messy inquiries into structured, actionable workflow records.

## 7.2 Features

* Unified lead record
* Lead timeline
* Lead statuses
* Qualification workflow
* House-rule evaluation
* Fit result
* Duplicate detection
* Lead merge tool
* Review queue
* Saved views and filters
* Manual override controls
* Property assignment

## 7.3 Lead lifecycle

The basic lifecycle is:

1. inquiry arrives
2. lead is created or matched
3. lead is normalized
4. missing questions are identified
5. qualification begins
6. fit is computed
7. lead is routed
8. operator reviews or advances
9. lead is scheduled, invited, declined, or archived

## 7.4 How it should work

### Unified lead record

Every lead should have one canonical record with:

* contact details
* source history
* assigned property
* qualification answers
* fit result
* current status
* message threads
* activity history
* tasks or review items

### Lead statuses

The platform should support clear operational states such as:

* new
* awaiting response
* incomplete
* under review
* qualified
* caution
* tour scheduled
* application sent
* declined
* archived
* closed

### Qualification workflow

Qualification questions can be property-specific.
The system identifies required missing answers and helps gather them.
Qualification should not complete until required data is present.

### House-rule evaluation

Each property has rules such as no smoking, no pets, bathroom-sharing required, minimum stay preference, or parking availability.
Lead answers are checked against these rules.
The result is one of:

* pass
* caution
* mismatch
* unknown

### Duplicate detection

The platform should flag likely duplicates based on email, phone, and message similarity.
Duplicates require review before merge.

### Review queue

Leads with ambiguity, conflicts, mismatches, or caution states should appear in a review queue.
This queue should be filterable and assignable.

### Merge tool

Operators should be able to merge duplicate lead records while preserving full history and source provenance.

### Manual override

Operators must be able to override fit results, route leads manually, reassign property, or decline regardless of automation state.
All overrides should be logged.

---

# 8. Communications

## 8.1 Purpose

Make Roomflow the central conversation hub for prospects across channels.

## 8.2 Features

* Email conversations
* SMS conversations
* WhatsApp conversations
* Instagram business messaging
* Shared thread per lead
* Message templates
* Formal invitations
* Formal notices
* Reminder messages
* Delivery/read tracking where available
* Internal notes
* @mentions
* Quiet hours
* Throttling

## 8.3 How it should work

### Unified conversation model

All inbound and outbound messages for a lead should appear in one conversation surface, even if they came from different channels.
Each message retains its original channel and metadata.

### Email

The platform should send transactional and conversational email and ingest inbound replies where configured.
Emails should thread into the correct lead when possible.

### SMS

The platform should support two-way SMS conversations, delivery status, opt-out handling, and sender identity by workspace or property.

### WhatsApp

Should behave like another supported messaging channel and appear in the unified conversation hub.

### Instagram business messaging

Instagram business messages should be linked to leads where possible and flow into the inbox.

### Templates

Users should be able to save reusable templates for:

* first reply
* qualification follow-up
* reminder
* tour confirmation
* application invitation
* decline
* waitlist notice
* house-rules acknowledgment request

Templates support variables such as lead first name, property name, missing fields, and tour time.

### Formal invitations and notices

These should be more structured than ordinary messages and have specific purpose types such as:

* screening invite
* tour invite
* application invite
* house-rules acknowledgment
* move-in onboarding message
* polite decline notice

These messages should support branded formatting where appropriate.

### Internal notes and mentions

Operators can add private notes to a lead and mention teammates.
Internal notes do not send externally.

### Quiet hours and throttling

Automated outbound messages must respect quiet hours, rate limits, and opt-out states.

---

# 9. AI features

## 9.1 Purpose

Use AI to reduce manual work, accelerate communication, and improve operational clarity.

## 9.2 Features

* Inquiry-to-profile extraction
* Missing-info detection
* AI reply drafting
* AI follow-up drafting
* AI summaries
* AI conflict explanations
* AI next-best-action suggestions
* AI duplicate suggestions
* AI translation
* AI listing analyzer
* AI house rules generator
* AI intake form generator
* AI workflow template generator
* Portfolio-level AI insights
* Source-quality AI summaries
* Stale lead AI recommendations

## 9.3 How it should work

### Inquiry-to-profile extraction

AI reads inquiry content and extracts structured fields such as move-in date, budget, stay length, smoking status, parking need, and bathroom-sharing acceptance.
Each extracted value should include confidence and evidence.
Operators can accept, edit, or reject suggestions.

### Missing-info detection

AI compares current lead data to the property’s required questions and identifies what is still missing.
The system should use this to draft the next message or update the operator view.

### AI reply drafting

Operators can generate message drafts for common actions.
Drafts should reflect property context, house rules, and known lead data.

### AI summaries

Each lead should have a concise summary explaining who the prospect is, current status, missing information, and recommended next step.

### Conflict explanations

When a lead triggers caution or mismatch, AI explains the issue in operational language tied to property rules.

### Next-best-action suggestions

AI recommends the next workflow step such as ask for missing info, schedule a tour, review a mismatch, or send an application invite.

### Duplicate suggestions

AI can suggest likely duplicate leads but should not auto-merge.

### Translation

Inbound messages can be translated into the operator’s language, and drafts can be translated back for the prospect.
Original content should always remain viewable.

### Listing analyzer

AI reviews listing text for clarity, missing expectations, and likely sources of poor-fit leads.

### House rules generator

AI helps generate a first draft of house rules based on property inputs.

### Intake form generator

AI suggests prescreening questions based on the property type and house rules.

### Workflow template generator

AI can generate automation/workflow templates such as new lead follow-up sequences or tour reminder flows.

### Portfolio insights

Org users can receive AI-generated summaries across properties such as lead quality trends, rule friction, and source performance.

### Stale lead recommendations

AI identifies aging leads and suggests archive, reminder, review, or re-engagement actions.

---

# 10. Workflow automation

## 10.1 Purpose

Allow operators to automate repeated lead-handling tasks while staying in control.

## 10.2 Features

* Node-based workflow builder
* Trigger / condition / action flows
* Auto-follow-up flows
* Auto-reminders
* Lead routing automations
* Screening completion automations
* Tour reminder automations
* Stale lead automations
* Approval-required steps
* Reusable workflow templates
* Property-specific workflows
* Org-wide automation library

## 10.3 How it should work

### Workflow model

Workflows are built from:

* triggers
* conditions
* actions

Examples of triggers:

* lead created
* message received
* fit result changed
* tour scheduled
* screening completed
* application invite sent
* lead stale threshold reached

Examples of conditions:

* property equals X
* fit equals caution
* channel available is SMS
* missing field includes budget
* lead has not replied in 24 hours

Examples of actions:

* send template
* draft AI message
* create task
* assign lead
* move status
* notify operator
* schedule reminder
* request approval

### Approval-required steps

Certain workflow actions should require approval by default, especially decline notices, certain routing actions, and sensitive screening-related steps.

### Templates

The system should include starter workflow templates and allow users to save their own.

### Scope

Personal can use simpler automations.
Org can use more advanced workflows, shared libraries, and broader trigger/action depth.

---

# 11. Scheduling

## 11.1 Purpose

Coordinate tours and prospect meetings from within the lead workflow.

## 11.2 Features

* Tour scheduling
* Calendar sync
* Google Calendar integration
* Outlook calendar integration
* Availability windows
* Team scheduling
* Reschedule / cancel flows
* Reminder messages
* No-show tracking

## 11.3 How it should work

Operators can create tours manually or from a qualified lead.
A tour is linked to the lead and property.
If calendar integration is enabled, the event syncs to the selected calendar.

Availability windows should be definable by user or property.
In Org, round-robin or assigned scheduling should be supported.

When a tour is scheduled, the system should support confirmation messaging and reminders.
If a tour is canceled or rescheduled, the lead timeline and event record should update without losing history.

No-shows should be recordable as structured outcomes.

---

# 12. Screening and verification

## 12.1 Purpose

Allow operators to launch and track screening and verification workflows through third-party providers.

## 12.2 Features

* Screening provider launch center
* Background check API integrations
* Identity verification integrations
* Screening package selector
* Screening invite flow
* Screening status tracker
* Report reference storage
* Consent / authorization tracking
* Adverse-action workflow tracking
* Screening audit trail
* Pass-through screening charges

## 12.3 How it should work

Roomflow should orchestrate screening rather than become the screening engine.
Operators choose a connected provider and screening package, then send an invite.
The applicant or prospect completes the provider-hosted flow.
Roomflow stores status updates, timestamps, and report references.

The platform should track:

* screening requested
* invite sent
* consent completed
* screening in progress
* report completed
* operator reviewed
* adverse-action step recorded

Background check and identity verification should always be explicit operator actions, not silent automatic background intelligence.

---

# 13. Integrations

## 13.1 Purpose

Connect Roomflow to the external systems operators use for lead intake, communications, calendar, screening, and automation.

## 13.2 Features

* Email provider integrations
* SMS provider integrations
* WhatsApp provider integrations
* Meta Lead Ads ingestion
* Instagram messaging integration
* Zillow feed/listing sync path
* Apartments.com feed/listing sync path
* Generic inbound webhook ingestion
* CSV import/export
* Zapier / Make / n8n webhook support
* Slack notifications
* Google Drive / file storage later
* S3-compatible file storage

## 13.3 How it should work

### Provider model

Each integration should be represented as a connection with:

* provider type
* status
* credentials or auth linkage
* mapping/configuration
* health state
* sync history

### Lead ingestion integrations

Roomflow should support multiple input patterns:

* native API integration
* webhooks
* inbound email parsing
* feed or file import
* manual import

### Messaging integrations

These power the unified inbox and outbound communication tools.
Each channel connection should expose send/receive capability, identity, and status.

### Listing feed integrations

Roomflow should support feed-based listing export/sync paths where direct partner access exists.
The product should also support fallback listing metadata management even when a direct partner sync is not available.

### Automation integrations

Outbound webhooks should allow customers to push events into external systems.

### Health and setup UX

The product should include an integrations hub, setup wizards, and health monitoring for failed connections, expired credentials, and sync errors.

---

# 14. Portals and external-facing flows

## 14.1 Purpose

Provide branded external experiences for prospects and public lead acquisition.

## 14.2 Features

* Prospect portal
* Branded application invite page
* Branded scheduling page
* Branded house-rules acknowledgment page
* Prospect status page
* Waitlist signup page
* Public lead capture form
* Free AI tools landing pages
* Embedded qualification form

## 14.3 How it should work

External pages should be tied to secure tokens or branded workspace/public URLs.
These flows should feel professional and reduce manual coordination.

### Prospect portal

A prospect can review next steps, appointment details, invites, or acknowledgment items.

### Scheduling page

Allows a prospect to choose an available time slot if enabled.

### House-rules acknowledgment page

Used when a lead needs to confirm they have read and accepted property rules before a later stage.

### Prospect status page

Gives a lightweight view into where they are in the process without exposing internal notes.

### Waitlist page

Captures future interest when rooms are unavailable.

### Public AI tools

These act as acquisition funnels and include things like a reply generator, listing analyzer, or rules generator.

---

# 15. Org and team collaboration

## 15.1 Purpose

Make Roomflow usable by teams, not just solo operators.

## 15.2 Features

* Multi-user workspace
* Roles and permissions
* Team assignment
* Shared inbox
* Review ownership
* Tasks
* SLA timers
* Audit log
* Activity log by user
* Property-level permissions
* Internal comments and collaboration

## 15.3 How it should work

### Roles

Roles should define what a user can do in a workspace.
Examples include owner, admin, manager, and viewer.

### Team assignment

Leads, review items, and tasks can be assigned to specific team members.

### Shared inbox

Teams should be able to triage and collaborate in a common inbox.
Messages should support internal comments and private notes.

### Tasks and SLA timers

The platform should support operator tasks such as review this lead, follow up by X time, or handle screening result.
SLA timers can highlight overdue actions.

### Audit log

Org should maintain a detailed audit log of sensitive actions such as status changes, overrides, integration changes, and screening launches.

---

# 16. Analytics and reporting

## 16.1 Purpose

Help operators understand funnel performance, source quality, team responsiveness, and workflow friction.

## 16.2 Features

* Lead source performance
* Inquiry-to-qualified rate
* Inquiry-to-tour rate
* Inquiry-to-application rate
* Response time metrics
* Stale lead metrics
* Decline reason analytics
* Rule-friction analytics
* Team performance metrics
* Property performance metrics
* AI usage metrics
* Integration health metrics

## 16.3 How it should work

Analytics should be derived from workflow events and communication history.

### Funnel metrics

The system should show how leads progress from inquiry to qualified to tour to application.

### Source metrics

Operators should be able to compare channels, listings, and campaigns.

### Rule-friction analytics

The system should show which rules or missing questions most often slow or disqualify leads.

### Team metrics

Org can measure time to first response, review throughput, or overdue tasks.

### AI metrics

Track AI usage, acceptance of suggestions, and workflow impact.

### Integration health

Show which connected systems are healthy, failing, or disconnected.

---

# 17. Billing and monetization

## 17.1 Purpose

Support subscription plans, usage-sensitive billing, pass-through services, and future add-ons.

## 17.2 Features

* Personal and Org plans
* Included AI in both plans
* SMS overage handling
* Screening pass-through billing
* Referral / partner marketplace later
* Premium integration packaging later
* Premium onboarding later

## 17.3 How it should work

Each workspace has a subscription record and usage counters.
Base subscription covers the core plan.
Certain costs are usage-sensitive or pass-through.

### AI

Included in both plans, with practical usage limits behind the scenes if needed.

### SMS and messaging

Should be metered or capped according to plan design.

### Screening

Should generally be passed through to the applicant or workspace rather than hidden in the subscription.

### Future partner marketplace

Roomflow may later support referral revenue for related services such as screening, insurance, utility setup, or other move-in services.

---

# 18. Trust, safety, and compliance

## 18.1 Purpose

Protect operators, prospects, and the business from operational abuse, compliance problems, and unsafe automation.

## 18.2 Features

* Consent tracking
* Message opt-out handling
* Audit-ready logs
* Manual review checkpoints
* Sensitive workflow restrictions
* Secure file handling
* Session revocation
* Admin security controls

## 18.3 How it should work

### Consent tracking

When a workflow involves screening, verification, or certain communications, the system should retain evidence of consent or provider-hosted consent state.

### Opt-out handling

Messaging automations must stop for leads who opt out of applicable channels.

### Manual review checkpoints

Sensitive actions such as certain declines or screening-related workflow transitions should not be silently automated without guardrails.

### File handling

Uploads and attachments should be stored securely with access control and auditability.

### Security controls

Admins should be able to revoke sessions, review login activity, and manage risky auth or integration states.

---

# 19. Nice-to-haves and later platform expansion

## 19.1 Features

* Voice / call tracking
* Voicemail transcription
* Missed-call-to-text fallback
* E-sign acknowledgments
* Move-in onboarding pack
* Roommate etiquette pack
* Utility setup referrals
* Insurance referrals
* Lockbox / showing tool integrations
* Resident onboarding workflows

## 19.2 How they should work

These features extend Roomflow further down the operational funnel.
They should be layered in only after lead workflow, communications, integrations, and screening orchestration are strong.

---

# 20. Default rollout priority

## 20.1 Foundation

* Auth and identity
* Workspaces and plans
* Properties
* Leads and qualification workflow
* Communications hub

## 20.2 Core differentiators

* AI extraction, summaries, drafting, rule explanations
* Email and SMS integrations
* Templates and formal invites
* Review queue and overrides

## 20.3 Operational depth

* Scheduling and calendar sync
* Screening launch center
* Shared inbox and team collaboration
* Analytics

## 20.4 Platform power layer

* Workflow builder
* Meta and listing integrations
* External portals
* Org-level AI insights

---

# 21. Summary

Roomflow should behave as:

**an AI-powered operating system for room-rental lead intake, communications, qualification, automation, scheduling, screening orchestration, and team workflow.**

The platform should feel coherent across all major modules:

* sign in quickly
* connect channels
* capture leads
* qualify them with rules and AI
* communicate from one place
* automate repetitive work
* launch tours and screening
* collaborate as a team
* measure the funnel
* grow into deeper integrations over time
