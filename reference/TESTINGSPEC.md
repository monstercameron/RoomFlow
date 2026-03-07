# Roomflow — Comprehensive Testing Specification

This document defines the full testing strategy for Roomflow.

It covers:

* product behavior expectations
* test levels
* test architecture
* feature-by-feature test plans
* unit test scope
* integration test scope
* end-to-end test scope
* failure mode testing
* security and compliance testing
* AI behavior testing
* integration/provider testing
* performance and reliability testing
* release gates

The purpose of this document is to make Roomflow buildable and maintainable with confidence, especially as a first product with many connected workflows.

---

# 1. Testing philosophy

Roomflow is a workflow product.
That means the main risk is not only whether pages render.
The main risk is whether state changes, automations, communications, and integrations behave correctly across real sequences of events.

Testing should therefore focus on:

* correctness of workflow state transitions
* correctness of side effects
* preservation of audit history
* safe handling of integrations and failures
* predictable AI-assisted behavior
* confidence during refactors

The testing system should be designed to answer these questions:

* Did the right thing happen?
* Did the wrong thing not happen?
* Was the result stored correctly?
* Was the user shown the correct outcome?
* Were side effects triggered exactly when intended?
* Was sensitive behavior blocked when it should have been?

---

# 2. Testing goals

## 2.1 Primary goals

* prevent regressions in core workflow logic
* validate business rule enforcement
* validate side effects such as messages, tasks, and sync jobs
* ensure integrations degrade safely
* ensure AI features remain assistive and predictable
* support frequent iteration with low fear

## 2.2 Secondary goals

* reduce manual QA effort
* make refactoring safer
* improve onboarding for future contributors
* create release confidence for both Personal and Org features

---

# 3. Test pyramid for Roomflow

Roomflow should use a broad test pyramid.

## 3.1 Unit tests

Fast, deterministic, focused tests for business logic and pure functions.

## 3.2 Integration tests

Tests that verify cooperation between modules, database, queues, APIs, and provider adapters.

## 3.3 End-to-end tests

Tests that validate critical real-world user flows across the running application.

## 3.4 Manual QA / exploratory tests

Used for visual, UX, judgment-heavy, and edge-case validation that is difficult to encode early.

## 3.5 Non-functional testing

Performance, reliability, security, and operational checks.

The majority of coverage should come from:

* business-logic unit tests
* database-backed integration tests
* a small but strong E2E critical path suite

---

# 4. Recommended testing layers

## 4.1 Unit testing

Purpose:

* test pure business logic
* validate state transitions
* validate rule evaluation
* validate templating behavior
* validate AI output parsing and post-processing

Focus areas:

* status transitions
* fit result computation
* required-field logic
* routing logic
* duplicate detection scoring helpers
* permissions
* throttling logic
* usage limit logic
* integration adapter mappers

## 4.2 Integration testing

Purpose:

* validate database writes and reads
* validate API handlers
* validate service orchestration
* validate job workers
* validate provider adapter behavior against mocks/fakes
* validate auth/session behavior

Focus areas:

* API to DB behavior
* workflow events to side effects
* webhook ingest to lead/thread updates
* message sending pipelines
* AI generation storage and downstream updates
* screening launch flows
* calendar sync flows

## 4.3 End-to-end testing

Purpose:

* validate the product from the user’s perspective
* catch routing, auth, session, UI wiring, and state sync failures

Focus areas:

* signup/login
* property setup
* lead ingestion
* AI-assisted follow-up
* manual review
* send message
* qualify lead
* schedule tour
* invite teammate
* connect an integration

## 4.4 Manual testing

Purpose:

* evaluate usability and presentation
* catch design/system-level issues not fully expressed in assertions
* review AI output quality and safety

Focus areas:

* inbox usability
* summary readability
* message tone quality
* setup wizard clarity
* error state quality
* upgrade prompt clarity

---

# 5. Test environment strategy

## 5.1 Local development environment

Use a predictable local environment with:

* application server
* test database
* worker process if applicable
* fake email/SMS providers
* fake AI provider or deterministic fixture mode

## 5.2 CI environment

CI should run:

* linting
* type/build checks if applicable
* unit tests
* integration tests
* key E2E smoke tests

## 5.3 Staging environment

Staging should resemble production enough to validate:

* auth flows
* webhooks
* integration wiring
* background jobs
* error logging
* deployment safety

## 5.4 Test data strategy

Use:

* seed workspaces
* seed properties
* seed leads
* fake message threads
* fake AI outputs
* fake provider payloads

Test data should include:

* clean pass cases
* caution cases
* mismatch cases
* duplicate leads
* stale leads
* opt-out leads
* invalid integration states

---

# 6. Feature-by-feature testing specification

---

# 6A. Auth and identity testing

## 6A.1 Features covered

* email + password signup/login
* magic link login
* Google login
* Facebook / Meta login
* Microsoft login
* Apple login
* passkeys
* account linking
* email verification
* password reset
* session/device management
* workspace invites
* workspace switching

## 6A.2 Expected behaviors

* users can create an account successfully
* verification state is tracked correctly
* login methods can be linked safely
* invite flows preserve workspace context
* switching workspaces changes data scope correctly
* session revocation invalidates access immediately

## 6A.3 Unit tests

Test:

* token creation and expiration helpers
* invite acceptance rules
* account linking guards
* verified email merge rules
* role assignment helpers
* session validity checks
* rate-limit rule helpers

## 6A.4 Integration tests

Test:

* signup endpoint creates user and workspace
* email verification marks account verified
* password reset token flow updates password
* invite acceptance attaches membership
* account linking writes provider records properly
* workspace switching updates session/workspace context

## 6A.5 E2E tests

Test flows:

1. signup with email/password -> verify email -> login -> onboarding
2. login with magic link
3. signup with Google -> link password later
4. owner invites teammate -> teammate accepts invite -> joins workspace
5. user with multiple workspaces switches workspace and sees correct scoped data

## 6A.6 Failure/edge cases

* invalid or expired magic link
* expired invite token
* duplicate account creation attempt
* same email across providers
* revoked session continuing to access app
* unverified email trying restricted action

## 6A.7 Security tests

* brute-force rate limiting
* token replay prevention
* CSRF/session integrity
* session fixation prevention if relevant
* password reset token single-use enforcement

---

# 6B. Workspaces and plans testing

## 6B.1 Features covered

* Personal plan
* Org plan
* workspace membership
* feature gating
* usage counters
* upgrade triggers
* downgrade-safe behavior

## 6B.2 Expected behaviors

* Personal users see only allowed features
* Org users can access team features
* feature gating is enforced consistently server-side and UI-side
* downgrade does not destroy data
* upgrade expands allowed actions immediately after billing success

## 6B.3 Unit tests

Test:

* plan feature checks
* usage-limit evaluation helpers
* upgrade requirement checks
* downgrade eligibility helpers
* seat/property limit math

## 6B.4 Integration tests

Test:

* workspace created with correct plan defaults
* feature-flag checks block forbidden API actions
* property count limit prevents new property creation on Personal when exceeded
* user invite blocked on Personal
* downgrade disables advanced integrations safely without deleting records

## 6B.5 E2E tests

Test flows:

1. Personal workspace attempts Org-only feature -> sees upgrade prompt
2. Org workspace invites teammate successfully
3. subscription plan changes -> feature access updates accordingly

## 6B.6 Failure/edge cases

* stale subscription state in app session
* usage counter desync
* downgrade with too many properties/users
* unpaid subscription grace period handling

---

# 6C. Properties and listings testing

## 6C.1 Features covered

* property creation/editing
* property settings
* house rules
* qualification questions
* listing metadata
* listing optimizer
* listing sync status

## 6C.2 Expected behaviors

* property records save correctly
* rules/questions remain scoped to property
* property changes affect future qualification behavior
* listing analyzer produces suggestions without mutating original content unless user confirms

## 6C.3 Unit tests

Test:

* property validation
* rule normalization helpers
* question ordering logic
* rule-category mappers
* listing analyzer post-processing rules

## 6C.4 Integration tests

Test:

* create property -> attach rules/questions -> retrieve complete property config
* property edit recomputes affected workflow context where needed
* property assignment changes trigger downstream fit recomputation job or state flag

## 6C.5 E2E tests

Test flows:

1. create first property during onboarding
2. add rules and questions
3. edit property and verify UI updates
4. run listing analyzer and save suggested improvements manually

## 6C.6 Failure/edge cases

* duplicate property names
* invalid rule configuration
* deleting property with active leads
* changing rules after leads already exist

---

# 6D. Leads and qualification workflow testing

## 6D.1 Features covered

* lead creation
* duplicate matching
* lead statuses
* qualification workflow
* required question logic
* house-rule evaluation
* fit result computation
* review queue
* merge tool
* manual overrides
* saved views/filters

## 6D.2 Expected behaviors

* inquiries produce or update the correct lead
* missing required data results in incomplete/awaiting response behavior
* rule violations produce the correct fit result
* status and fit remain separate concepts
* overrides are logged
* merges preserve full history

## 6D.3 Unit tests

Test:

* lead matching logic
* status transition rules
* fit computation
* required-field detection
* routing helper decisions
* duplicate scoring helper
* merge conflict resolver logic
* review-queue inclusion rules

## 6D.4 Integration tests

Test:

* inquiry creates lead and activity event
* duplicate inquiry attaches to existing lead
* missing info follow-up state is stored correctly
* completed answers trigger fit computation
* caution lead appears in review queue
* operator override changes state and logs event
* merge action preserves thread/activity provenance

## 6D.5 E2E tests

Test flows:

1. paste/import inquiry -> lead created -> AI extraction shown
2. lead with missing required info -> send follow-up -> status updates
3. lead answers conflict with no-smoking rule -> fit becomes mismatch/caution and review appears
4. operator manually qualifies a caution lead
5. duplicate lead suggestion -> merge records

## 6D.6 Failure/edge cases

* one person inquiring about multiple properties
* conflicting answers over time
* reassignment to a different property
* deleted/missing property on existing lead
* duplicate detection false positives
* archived lead reactivated by new message

## 6D.7 State-machine tests

Create explicit tests for every allowed transition and blocked transition.
Example:

* qualified -> tour_scheduled allowed
* declined -> application_sent blocked unless explicit reopen flow exists

---

# 6E. Communications testing

## 6E.1 Features covered

* unified inbox
* email
* SMS
* WhatsApp
* Instagram messaging
* templates
* formal invitations
* notices
* internal notes
* @mentions
* quiet hours
* throttling
* opt-out handling

## 6E.2 Expected behaviors

* messages appear in correct thread
* channel metadata is preserved
* templates render safely
* formal messages use the right format/purpose
* internal notes are never sent externally
* opt-out stops automated communication on relevant channels
* throttling prevents repeated spam sends

## 6E.3 Unit tests

Test:

* template variable rendering
* fallback behavior for missing variables
* message-throttle logic
* quiet-hours evaluation
* channel selection priority
* note vs external message classification
* opt-out enforcement helpers

## 6E.4 Integration tests

Test:

* outbound email creates send log and message record
* inbound email reply attaches to correct thread
* outbound SMS creates message record and provider adapter call
* STOP/opt-out inbound message updates opt-out state
* formal invitation message stores invitation metadata
* private note appears only internally

## 6E.5 E2E tests

Test flows:

1. operator drafts and sends email follow-up
2. operator sends SMS and receives reply
3. prospect opts out -> automation no longer sends messages
4. create formal application invitation from lead
5. add internal note and mention teammate

## 6E.6 Failure/edge cases

* message provider timeout
* message send partial success
* failed delivery status callback
* reply from unknown sender
* template with unresolved variable
* duplicate inbound webhook delivery
* channel unavailable but automation tries to send

---

# 6F. AI features testing

## 6F.1 Features covered

* extraction
* missing-info detection
* AI drafting
* summaries
* conflict explanations
* duplicate suggestions
* translation
* listing analyzer
* house rules generator
* intake form generator
* next-best-action suggestions
* portfolio insights
* stale lead recommendations

## 6F.2 Testing philosophy for AI

AI outputs are probabilistic.
Testing should not depend on exact natural-language output.
Instead test:

* schema correctness
* allowed output structure
* required facts included
* forbidden content absent
* confidence/evidence handling
* storage and workflow effects

Use fixture-based, deterministic, and mocked modes for most automated tests.
Use manual review and evaluation suites for qualitative checks.

## 6F.3 Unit tests

Test:

* prompt input builders
* output schema validators
* extraction normalization
* fallback handling when AI output is malformed
* rule explanation formatter
* AI recommendation mapper
* translation result application rules
* usage-meter accounting

## 6F.4 Integration tests

Test:

* inquiry text -> mocked AI extraction -> fields stored correctly
* summary generation -> summary record saved and shown
* draft generation -> draft returned but not auto-sent unless configured
* malformed AI response -> safe fallback and logged error
* next-best-action suggestion -> recommendation stored and surfaced
* translation output -> original + translated content stored appropriately

## 6F.5 E2E tests

Test flows:

1. paste inquiry -> AI extracts fields -> operator accepts them
2. open lead -> AI summary visible
3. click draft reply -> editable draft generated
4. mismatch explanation visible after rules evaluation
5. listing analyzer returns suggestions and user applies one

## 6F.6 Safety tests

Test that AI outputs do not:

* create hidden approval/denial decisions
* infer protected traits
* fabricate missing facts as confirmed facts
* auto-send sensitive messages without required approval

## 6F.7 Evaluation suite

Maintain a curated set of realistic inquiry examples and expected structured outputs.
This should include:

* clean inquiries
* vague inquiries
* contradictory inquiries
* multilingual inquiries
* sarcasm/noise/spam
* room-specific cases

Each sample should have expected extracted fields and missing-field results.

---

# 6G. Workflow automation testing

## 6G.1 Features covered

* workflow builder
* trigger-condition-action engine
* auto-follow-ups
* reminders
* routing automations
* approval-required steps
* reusable templates
* org libraries

## 6G.2 Expected behaviors

* workflows trigger only when intended
* conditions evaluate correctly
* actions run in correct order
* approval gates stop execution at the right points
* failed actions are logged and retried according to policy

## 6G.3 Unit tests

Test:

* trigger matcher
* condition evaluator
* workflow graph validation
* action scheduling logic
* approval-gate rules
* retry/backoff policy

## 6G.4 Integration tests

Test:

* lead created event triggers configured workflow
* no reply within threshold triggers reminder action
* mismatch triggers review task instead of auto-decline if policy requires approval
* workflow failure marks execution failed and preserves audit trail

## 6G.5 E2E tests

Test flows:

1. configure simple follow-up workflow
2. create new lead
3. verify workflow schedules and sends follow-up
4. create workflow with approval gate -> action pauses for approval

## 6G.6 Failure/edge cases

* circular workflow definitions
* duplicated trigger execution from webhook replay
* condition depends on missing data
* workflow action partially succeeds
* job retry causing duplicate sends

---

# 6H. Scheduling testing

## 6H.1 Features covered

* tour creation
* calendar sync
* availability windows
* reschedule/cancel
* reminders
* no-show tracking

## 6H.2 Expected behaviors

* tours are linked to correct lead and property
* calendar provider event IDs are persisted
* reschedule/cancel preserves history
* reminders send on time
* no-show status is recorded as structured event

## 6H.3 Unit tests

Test:

* availability calculation helpers
* event duration rules
* reminder scheduling helpers
* reschedule status transition rules

## 6H.4 Integration tests

Test:

* scheduling creates internal event and external calendar call
* cancellation updates internal state and external event
* calendar webhook updates local event status
* no-show action updates lead timeline

## 6H.5 E2E tests

Test flows:

1. qualify lead -> schedule tour -> event appears in app
2. reschedule tour
3. cancel tour
4. mark no-show

## 6H.6 Failure/edge cases

* calendar token expired
* conflicting slot reservation
* provider event missing after creation
* double reminder scheduling

---

# 6I. Screening and verification testing

## 6I.1 Features covered

* screening launch center
* provider selection
* screening package selection
* invite flow
* status tracking
* consent tracking
* report references
* adverse-action tracking

## 6I.2 Expected behaviors

* screening launches only when provider is connected and user has permission
* status changes are stored and surfaced
* provider-hosted flow references are tracked
* consent state is recorded
* audit trail is complete

## 6I.3 Unit tests

Test:

* screening launch eligibility
* package mapping logic
* adverse-action workflow state helpers
* permission checks

## 6I.4 Integration tests

Test:

* launch screening request -> create request record -> call provider adapter
* provider webhook updates status
* consent record stored correctly
* report completion updates timeline and notifications
* repeated webhook delivery is idempotent

## 6I.5 E2E tests

Test flows:

1. connect screening provider (or use seeded test provider)
2. launch screening from lead
3. provider callback updates status
4. operator reviews screening state

## 6I.6 Failure/edge cases

* provider connection missing
* webhook signature invalid
* report incomplete
* expired invitation
* user lacking permission tries to launch screening

---

# 6J. Integrations testing

## 6J.1 Features covered

* provider connections
* connection statuses
* health center
* inbound webhooks
* outbound webhooks
* CSV import/export
* feed/listing syncs
* Slack notifications
* storage integrations

## 6J.2 Expected behaviors

* integration connections store credentials and config correctly
* statuses transition correctly on setup, health failure, and disconnect
* inbound events are idempotent
* outbound webhooks are signed, retried, and logged
* imports create valid records with proper provenance

## 6J.3 Unit tests

Test:

* provider config validators
* connection state helpers
* event signature verification helpers
* CSV mapping/validation helpers
* external-to-internal payload mappers

## 6J.4 Integration tests

Test:

* connect provider -> store connection state
* inbound webhook -> create/update lead or message
* outbound webhook -> enqueue delivery and log result
* import CSV -> create leads and record source metadata
* health failure -> connection marked degraded/error

## 6J.5 E2E tests

Test flows:

1. connect email/SMS/calendar provider
2. process inbound webhook event
3. send outbound webhook to test endpoint
4. import leads from CSV

## 6J.6 Failure/edge cases

* duplicate webhook deliveries
* signature mismatch
* malformed payload
* expired OAuth token
* provider outage
* partial CSV import failure

---

# 6K. Portals and external-facing flows testing

## 6K.1 Features covered

* prospect portal
* application invite page
* scheduling page
* house-rules acknowledgment page
* status page
* waitlist page
* public lead capture form
* free AI tools landing pages
* embedded qualification form

## 6K.2 Expected behaviors

* secure external pages only expose intended data
* tokenized links work and expire correctly
* submissions create correct internal records
* public tools do not expose internal workspace data

## 6K.3 Unit tests

Test:

* token generation/expiration
* page access policy helpers
* public-form validation
* branded-URL/path helpers

## 6K.4 Integration tests

Test:

* invite link opens correct lead context
* house-rules acknowledgment stores acceptance record
* public form creates lead in correct workspace/property
* waitlist signup creates proper status/source records

## 6K.5 E2E tests

Test flows:

1. operator sends application invite -> prospect opens invite page
2. operator sends rules acknowledgment -> prospect submits acknowledgment
3. public lead capture form -> lead appears in inbox

## 6K.6 Failure/edge cases

* expired token link
* token reuse
* public form spam submission
* prospect accessing wrong workspace asset via token tampering

---

# 6L. Org and collaboration testing

## 6L.1 Features covered

* multi-user workspace
* roles/permissions
* team assignment
* shared inbox
* tasks
* SLA timers
* audit log
* internal collaboration
* property-level permissions

## 6L.2 Expected behaviors

* role restrictions are enforced on every sensitive action
* task ownership is tracked correctly
* SLA timers update based on events
* audit logs record sensitive actions accurately
* property-specific access scopes behave correctly

## 6L.3 Unit tests

Test:

* permission matrix helpers
* assignment rules
* SLA deadline calculators
* audit event builders
* property-scope access rules

## 6L.4 Integration tests

Test:

* manager can edit assigned leads but viewer cannot
* invite creates member with proper role
* task creation and reassignment are logged
* audit entry created after override/integration change/status change

## 6L.5 E2E tests

Test flows:

1. owner invites manager
2. manager handles a lead
3. viewer attempts forbidden edit and is blocked
4. task created and completed from review queue

## 6L.6 Failure/edge cases

* removed user still has stale session
* reassigned property access mismatch
* audit log missing actor on background/system actions

---

# 6M. Analytics and reporting testing

## 6M.1 Features covered

* source performance
* funnel metrics
* response time metrics
* stale lead metrics
* decline reasons
* rule friction
* team performance
* AI usage
* integration health

## 6M.2 Expected behaviors

* metrics derive correctly from source events
* time ranges filter correctly
* workspace isolation is preserved
* analytics remain stable after backfills/recomputations

## 6M.3 Unit tests

Test:

* metric aggregation helpers
* date-range bucketing
* response-time calculations
* conversion metric formulas
* AI usage aggregation helpers

## 6M.4 Integration tests

Test:

* workflow event sequences produce expected analytics values
* filters by property/source/user work correctly
* archived/declined leads count correctly in relevant views

## 6M.5 E2E tests

Test flows:

1. create sample leads in different states
2. verify funnel metrics on dashboard
3. verify source and property filters change results correctly

## 6M.6 Failure/edge cases

* timezone boundary issues
* duplicate event causing double counting
* deleted integration/source affecting old analytics

---

# 6N. Billing and monetization testing

## 6N.1 Features covered

* plan assignment
* upgrade/downgrade
* usage counters
* SMS overage logic
* screening pass-through logic
* grace period behavior

## 6N.2 Expected behaviors

* billing state changes feature availability properly
* usage counters update accurately
* overage calculations are correct
* downgrades disable unsupported features safely

## 6N.3 Unit tests

Test:

* usage-meter increment rules
* plan limit checks
* overage calculation helpers
* downgrade consequence calculator

## 6N.4 Integration tests

Test:

* subscription webhook updates plan state
* usage counter crosses threshold -> warning state triggered
* downgrade disables advanced integration access but preserves records

## 6N.5 E2E tests

Test flows:

1. upgrade Personal to Org
2. Org features become available
3. exceed usage threshold and see proper notice

## 6N.6 Failure/edge cases

* duplicate billing webhook deliveries
* stale plan state cached in session
* payment failure during active workflows

---

# 6O. Trust, safety, and compliance testing

## 6O.1 Features covered

* consent tracking
* opt-out handling
* audit logs
* manual review checkpoints
* secure file handling
* session revocation
* admin security controls
* sensitive action restrictions

## 6O.2 Expected behaviors

* consent evidence is stored and retrievable
* opt-out prevents future automated sends on the correct channel
* audit logs are immutable enough for operational trust
* secure files require correct permissions
* revoked sessions lose access immediately or within defined policy

## 6O.3 Unit tests

Test:

* opt-out enforcement rules
* file access authorization
* sensitive-action approval requirements
* audit-event integrity builders

## 6O.4 Integration tests

Test:

* opt-out inbound event blocks future automation
* file download blocked for unauthorized user
* sensitive workflow action requires approval and cannot bypass API-side guard

## 6O.5 E2E tests

Test flows:

1. prospect opts out of SMS -> automation later attempts send -> blocked
2. restricted user attempts secure file access -> blocked
3. admin revokes another session -> access removed

## 6O.6 Compliance-oriented regression tests

Create explicit regression cases around:

* no auto-deny by AI default
* protected-trait inference not surfaced
* decline flow requiring appropriate user action/policy
* provider-hosted screening consent state required before screening-complete actions

---

# 7. Cross-cutting test scenarios

These scenarios span multiple modules and should exist as named integration or E2E flows.

## 7.1 New lead from text to qualification

* inbound SMS
* lead created
* AI extraction
* missing info follow-up
* reply received
* fit computed
* lead routed to qualified

## 7.2 Lead with mismatch and manual override

* lead created
* no-smoking rule violated
* fit mismatch
* review queue entry
* operator override to caution/qualified
* audit event created

## 7.3 Screening from qualified lead

* qualified lead
* operator launches screening
* screening webhook updates status
* lead shows screening state
* task created for review

## 7.4 Tour scheduling flow

* qualified lead
* schedule tour
* calendar sync
* reminder send
* reschedule
* no-show recording

## 7.5 Org collaboration flow

* owner invites manager
* manager handles inbox item
* internal note and task created
* audit trail updated

## 7.6 Upgrade flow

* Personal user hits Org-only feature
* billing upgrade succeeds
* feature unlocks
* user connects advanced integration

---

# 8. Test doubles and provider simulation

## 8.1 AI provider test strategy

Use three modes:

* pure mocked responses for most tests
* deterministic fixture mode for integration tests
* manual/adversarial review mode for prompt/output quality

## 8.2 Messaging provider test strategy

Use provider adapters with fake implementations that simulate:

* successful send
* failed send
* delayed delivery
* inbound message webhook
* opt-out event

## 8.3 Calendar provider test strategy

Simulate:

* create/update/delete success
* token expiry
* duplicate webhook
* missing provider event

## 8.4 Screening provider test strategy

Simulate:

* request launched
* consent complete
* report complete
* invalid webhook
* duplicate webhook
* provider outage

## 8.5 Storage provider test strategy

Simulate:

* upload success
* access denied
* expired link
* deletion failure

---

# 9. Data integrity testing

Roomflow is highly stateful.
Data integrity tests are critical.

## 9.1 What to validate

* activity timeline records all important state changes
* merge operations preserve message/thread history
* status transitions remain valid after retries/webhook duplication
* provider external IDs remain unique per provider object type
* AI outputs are tied to correct lead/thread context
* archived or deleted states do not orphan related records incorrectly

## 9.2 Data integrity test cases

* merge duplicate lead with existing threads
* replay webhook twice
* queue retry after partial failure
* change property and recompute fit
* reconnect provider after degraded state

---

# 10. Background jobs and idempotency testing

## 10.1 Job types to test

* send message job
* AI generation job
* follow-up reminder job
* stale lead scan job
* webhook processing job
* calendar sync job
* screening sync job

## 10.2 Required behaviors

* jobs can retry safely
* duplicate processing does not double-send or double-create records
* job failure is logged and observable
* permanent failures surface to operator/admin where needed

## 10.3 Unit tests

Test:

* retry policy
* idempotency key generation
* job state transitions

## 10.4 Integration tests

Test:

* same webhook payload delivered twice -> one resulting state mutation
* send-message retry does not create duplicate external send log if idempotency enforced
* stale lead scan only marks eligible leads

---

# 11. Performance testing

## 11.1 Goals

Ensure the product remains responsive for realistic small-business loads.

## 11.2 What to test

* inbox load with many threads
* lead detail load with long message history
* dashboard queries
* search and filters
* analytics aggregation endpoints
* webhook bursts
* job queue throughput for message/AI tasks

## 11.3 Minimum performance checks

* basic page render under realistic seed volume
* search latency under moderate dataset
* webhook batch handling
* no N+1 query explosions on major pages

## 11.4 Failure thresholds

Set measurable thresholds later, but initially ensure:

* critical pages feel fast with seeded realistic data
* no catastrophic slowdown with hundreds or low thousands of leads/messages

---

# 12. Reliability and resilience testing

## 12.1 Simulate provider outages

* email provider unavailable
* SMS provider timeout
* AI provider failure
* calendar token revoked
* screening provider returns partial data

## 12.2 Expected behavior

* app remains usable where possible
* failures are logged
* users see actionable error states
* side effects are retriable
* core data is not corrupted

## 12.3 Chaos-lite scenarios

Include integration tests that intentionally fail one downstream service and verify:

* no duplicate records
* no stuck UI states
* operator sees degradation signal

---

# 13. Security testing

## 13.1 Areas to test

* authentication
* authorization
* workspace data isolation
* file access
* token handling
* webhook signature validation
* rate limiting
* session revocation
* secrets exposure in logs or responses

## 13.2 Required checks

* user from workspace A cannot access workspace B records
* viewer cannot perform manager actions
* unsigned webhook is rejected
* tampered tokenized invite page is rejected
* provider credentials never returned by normal API responses

---

# 14. Accessibility and UX testing

## 14.1 Scope

* keyboard navigation
* focus management
* form labeling
* contrast
* error states
* screen-reader-friendly buttons/forms where practical

## 14.2 Priority pages

* login/signup
* onboarding
* inbox
* lead detail
* property settings
* pricing/upgrade prompts

## 14.3 Manual UX checks

* can a first-time user understand onboarding?
* can an operator tell what action to take from a lead page?
* do AI suggestions feel helpful rather than noisy?

---

# 15. Release gates

A feature should not be considered ready until:

* core unit tests exist for business rules
* integration tests exist for main service path
* at least one E2E path covers user-visible flow if feature is core
* error cases are covered
* audit/security implications are considered
* manual QA notes exist for UX-heavy features

## 15.1 Must-pass before release

* auth smoke tests
* lead creation and qualification smoke tests
* message send/receive smoke tests
* AI extraction/draft smoke tests
* no critical access-control failures

---

# 16. Suggested test coverage priorities

## 16.1 Highest priority coverage

* lead lifecycle
* fit computation
* messaging flows
* AI extraction + summary + draft storage logic
* permissions and workspace isolation
* provider webhook idempotency
* audit logs on sensitive actions

## 16.2 Medium priority coverage

* scheduling
* screening orchestration
* analytics aggregation
* workflow builder
* portals

## 16.3 Lower priority early coverage

* listing analyzer polish
* advanced Org metrics
* referral/partner marketplace features

---

# 17. Suggested folder/test organization

Organize tests by domain, not just by technical layer.

Example high-level structure:

* auth/
* billing/
* properties/
* leads/
* messaging/
* ai/
* workflows/
* scheduling/
* screening/
* integrations/
* org/
* analytics/
* portals/
* security/

Within each domain, separate:

* unit
* integration
* e2e fixtures if applicable

---

# 18. Manual QA checklist starter

Before major releases, manually verify:

* signup/login/invite paths
* property onboarding
* lead creation from sample inquiry
* AI extraction quality on sample messages
* draft reply generation quality
* email and SMS sends
* review queue usability
* upgrade prompt clarity
* integration health/errors display
* workspace isolation with multiple users

---

# 19. Regression checklist starter

Maintain a permanent regression suite for:

* duplicate lead handling
* mismatch rule explanation
* opt-out enforcement
* override audit logging
* webhook replay idempotency
* invite acceptance flow
* workspace switching
* message template rendering
* screening launch state tracking
* stale lead automation

---

# 20. Final guidance

The most important principle is this:

**Test the workflow, not just the code.**

Roomflow’s value depends on multi-step operational behavior.
The safest development strategy is to encode the business rules, state transitions, side effects, and audit expectations into tests as early as possible.

If done well, the testing system will let Roomflow move quickly without becoming fragile as integrations, AI, and workflow depth expand.
