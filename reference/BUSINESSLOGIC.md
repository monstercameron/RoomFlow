# Roomflow — Workflow Business Logic

This document defines the initial **business logic**, **workflow rules**, **state transitions**, and **decision model** for Roomflow.

The intent is to move from product concept into a form that can be implemented directly in code, database schema, jobs, and UI actions.

---

# 1. Product logic boundaries

Roomflow is a workflow system for **post-inquiry lead handling** in shared housing and room-rental operations.

Roomflow is responsible for:

* capturing inbound inquiries
* normalizing lead data
* asking missing qualification questions
* checking house-rule fit
* routing leads to the appropriate next step
* tracking message history and state changes
* supporting operator review and override
* maintaining an audit trail

Roomflow is **not** responsible for:

* generating marketplace traffic
* making legal tenant approval decisions automatically
* formal credit/background screening itself
* generating leases in v1
* collecting rent in v1
* managing maintenance in v1

---

# 2. Core business entities

## 2.1 Workspace

A Workspace represents one operator account or business account.

A Workspace owns:

* users
* properties
* templates
* integrations
* leads
* rules
* workflows
* billing subscription

## 2.2 User

A User is a person who logs into the system.

Basic roles in v1:

* Owner
* Admin
* Manager
* Viewer

## 2.3 Property

A Property represents a shared house or room-rental location.

A Property contains:

* name
* address or area descriptor
* availability metadata
* house rules
* qualification question set
* lead routing defaults
* calendar configuration

## 2.4 Lead

A Lead represents a single prospect interested in renting a room.

A Lead has:

* contact identity
* source channel
* assigned property
* current status
* fit result
* message history
* qualification answers
* activity timeline
* disposition outcome

## 2.5 Inquiry

An Inquiry is the initial inbound event that creates or updates a Lead.

Examples:

* email inquiry
* form submission
* SMS message
* manual operator entry
* imported lead record

A lead may have one or many inquiries over time.

## 2.6 Message Thread

A Message Thread is the conversation history associated with a lead.

A thread may contain:

* inbound messages
* outbound messages
* automated prompts
* operator-authored responses
* system notices

## 2.7 Qualification Question

A Qualification Question is a structured question asked of a lead.

Examples:

* What is your target move-in date?
* What is your monthly budget?
* Do you smoke?
* Are you comfortable sharing a bathroom?

## 2.8 Qualification Answer

A Qualification Answer is a lead’s response to a Qualification Question.

## 2.9 House Rule

A House Rule is a property-specific operational condition used during qualification.

Examples:

* No smoking
* No pets
* Shared bathroom required
* No frequent overnight guests
* Minimum intended stay is 6 months

## 2.10 Fit Result

A Fit Result is the system’s current interpretation of lead compatibility against rules.

v1 fit categories:

* Pass
* Caution
* Mismatch
* Unknown

## 2.11 Template

A Template is a reusable outbound message used during workflow automation.

## 2.12 Tour Event

A Tour Event is a scheduled showing or call related to a lead.

## 2.13 Activity Event

An Activity Event is any meaningful state change or action for audit and timeline use.

Examples:

* lead created
* source assigned
* qualification request sent
* response received
* rule mismatch detected
* lead manually overridden
* tour scheduled
* application invite sent

---

# 3. Lead lifecycle overview

The high-level lead lifecycle is:

1. Inquiry arrives
2. Lead is created or matched
3. Lead is normalized
4. Missing data is identified
5. Qualification workflow is triggered
6. Lead responses are evaluated
7. Fit result is computed
8. Lead is routed to next step
9. Operator may review / override
10. Lead is either declined, scheduled, invited to apply, or archived

---

# 4. Lead statuses

Lead status should be explicit and mutually understandable by both operators and the system.

## 4.1 Primary statuses

* `new`
* `awaiting_response`
* `incomplete`
* `under_review`
* `qualified`
* `caution`
* `tour_scheduled`
* `application_sent`
* `declined`
* `archived`
* `closed`

## 4.2 Status meanings

### `new`

A new lead has been created but has not yet entered the qualification workflow.

### `awaiting_response`

The system or operator has asked for missing information and is waiting for the lead to reply.

### `incomplete`

The lead has replied, but key required data is still missing.

### `under_review`

The system has enough data to evaluate but requires operator review due to ambiguity, conflict, or cautionary result.

### `qualified`

The lead meets the property’s minimum workflow criteria and may proceed to tour or application.

### `caution`

The lead may be workable, but one or more non-fatal issues require human review.

### `tour_scheduled`

A tour or meeting has been scheduled.

### `application_sent`

The lead has been advanced to formal application.

### `declined`

The lead has been closed out due to mismatch, ineligibility, or operator decision.

### `archived`

The lead is inactive and hidden from active workflows but retained.

### `closed`

The lead lifecycle is complete because the lead rented, withdrew, or was otherwise finalized.

---

# 5. Fit result logic

Fit result is separate from status.

A lead may have:

* status = `under_review`
* fit = `caution`

This separation is important because fit is a compatibility interpretation while status is an operational workflow state.

## 5.1 Fit values

* `unknown`
* `pass`
* `caution`
* `mismatch`

## 5.2 Fit evaluation rules

### `unknown`

Assigned when required information is missing or no evaluation has run yet.

### `pass`

Assigned when all required rules are satisfied and no cautionary flags exist.

### `caution`

Assigned when required rules are satisfied, but one or more non-blocking conditions require review.

Examples:

* unclear move-in timing
* borderline stay length preference
* inconsistent answer wording
* missing non-required info

### `mismatch`

Assigned when one or more blocking rules are violated.

Examples:

* lead says they smoke when property is non-smoking
* lead requires pets when property disallows pets
* lead refuses shared bathroom when the room requires it

---

# 6. Lead creation logic

## 6.1 New inquiry handling

When an inquiry arrives, the system must determine whether to:

* create a new lead
* attach the inquiry to an existing lead
* flag the inquiry as ambiguous duplicate

## 6.2 Lead matching rules

A lead match may be attempted using:

* exact email match
* normalized phone number match
* recent thread association
* operator-confirmed manual match

## 6.3 Duplicate handling

If a new inquiry appears to match an existing lead with sufficient confidence:

* append inquiry to existing lead
* update `last_activity_at`
* create activity event `inquiry_attached`

If confidence is uncertain:

* create `possible_duplicate` flag
* require operator review

---

# 7. Lead normalization logic

After lead creation or update, the system attempts to normalize available information.

## 7.1 Extractable fields

The system should attempt to populate:

* full name
* preferred name
* email
* phone
* inquiry source
* desired property
* target move-in date
* budget
* intended stay length
* smoking status
* pet status
* parking need
* guest expectations
* bathroom-sharing acceptance
* work status or income description

## 7.2 Confidence model

Each extracted field should have:

* value
* source
* confidence
* last updated timestamp

If confidence is too low:

* do not silently overwrite confirmed values
* place field into suggested extraction state for review

---

# 8. Qualification workflow logic

## 8.1 Trigger conditions

A qualification workflow begins when:

* a new lead is created
* a lead is assigned to a property
* an operator manually starts qualification
* a lead’s property changes

## 8.2 Qualification prerequisites

Qualification cannot run unless:

* the lead is assigned to a property
* the property has an active question set or default question set
* there is at least one contactable communication channel, unless manual-only mode is enabled

## 8.3 Required vs optional questions

Each question must have:

* required flag
* display order
* answer type
* active flag
* optional route behavior

Missing required questions keep the fit result at `unknown`.

## 8.4 Automated question dispatch

If required data is missing, the system may send a follow-up message using the selected template.

Dispatch conditions:

* lead has not been declined
* lead has not opted out
* throttle window has not been violated
* contact method is available

## 8.5 Qualification completion criteria

Qualification is considered complete when:

* all required questions have valid answers
* fit result has been computed
* lead has been routed to review, qualify, or decline

---

# 9. House rule evaluation logic

## 9.1 Rule model

Each house rule should support:

* label
* description
* category
* active flag
* blocking behavior
* warning behavior
* operator note

A rule must be either:

* blocking
* warning-only
* informational

## 9.2 Rule categories

Suggested v1 rule categories:

* smoking
* pets
* guests
* bathroom sharing
* parking
* minimum stay
* work schedule compatibility
* general acknowledgment

## 9.3 Blocking rule behavior

If a blocking rule is violated:

* fit result becomes `mismatch`
* lead status may move to `under_review` or `declined` depending on automation settings
* an activity event is recorded
* the violating rule is shown in the lead summary

## 9.4 Warning rule behavior

If a warning rule is triggered:

* fit result becomes `caution` unless already `mismatch`
* lead status moves to `under_review` unless already manually set otherwise
* operator review is recommended

## 9.5 Informational rule behavior

Informational rules do not affect fit result directly.
They may be surfaced to the operator during review.

---

# 10. Routing logic

Routing determines what happens after qualification evaluation.

## 10.1 Routing outcomes

A lead may be routed to:

* request more information
* operator review
* qualified state
* schedule tour
* send application
* decline
* archive

## 10.2 Default routing logic

### Case A: required data missing

* fit = `unknown`
* status = `awaiting_response` or `incomplete`
* action = send follow-up

### Case B: blocking mismatch found

* fit = `mismatch`
* status = `under_review` or `declined`
* action = notify operator and optionally send decline template

### Case C: all rules pass cleanly

* fit = `pass`
* status = `qualified`
* action = optionally schedule tour or send next-step message

### Case D: warning triggered

* fit = `caution`
* status = `under_review`
* action = operator review needed

## 10.3 Manual override routing

Operators must be able to override routing.

Examples:

* convert a mismatch to review
* advance caution lead to qualified
* decline a pass lead
* archive a stale lead

Every override must create an activity event with:

* actor
* prior value
* new value
* reason
* timestamp

---

# 11. Communication logic

## 11.1 Message origins

Messages may be:

* inbound
* outbound_manual
* outbound_automated
* system_notice

## 11.2 Communication channel priority

If multiple channels exist, the workspace or property may define a preferred channel order.

Example:

1. SMS
2. email
3. manual-only fallback

## 11.3 Message sending conditions

Automated outbound messages may only send if:

* the lead is active
* the channel is valid
* the lead has not opted out
* the throttle window is respected
* the same template was not recently sent beyond policy

## 11.4 Follow-up throttling

To avoid spam, the system should enforce:

* minimum interval between automated messages
* daily send cap per lead
* no duplicate template resend without meaningful state change

## 11.5 Opt-out handling

If the lead opts out:

* automated messaging is disabled
* status may remain active
* operator can continue manual review but should not trigger automated outreach

---

# 12. Template logic

## 12.1 Template types

* initial reply
* qualification follow-up
* missing info reminder
* tour scheduling message
* application invite
* decline notice
* inactive lead nudge

## 12.2 Template variable substitution

Templates may reference fields such as:

* lead first name
* property name
* room type
* move-in date
* selected calendar link
* missing question labels

## 12.3 Template rendering fallback rules

If a variable is missing:

* use configured fallback value
* or suppress the phrase block
* never send broken placeholders to a lead

---

# 13. Tour scheduling logic

## 13.1 Scheduling prerequisites

A lead can be scheduled only if:

* status is `qualified` or manually allowed
* property supports scheduling
* an operator or calendar slot is available

## 13.2 Scheduling effects

When a tour is scheduled:

* create Tour Event
* set status = `tour_scheduled`
* create activity event
* send confirmation if enabled

## 13.3 Reschedule / cancel

If a tour is canceled:

* preserve event history
* update lead status back to `qualified` or `under_review`
* record cancel reason if available

---

# 14. Application invite logic

## 14.1 Invite prerequisites

Application invite may be sent when:

* lead is `qualified` or manually advanced
* required qualification data is complete
* operator chooses to advance the lead

## 14.2 Invite effects

When application invite is sent:

* status = `application_sent`
* record invite timestamp
* record invitation channel
* attach application URL if configured

## 14.3 Expiration / stale invites

If an invite is not acted upon within configured time:

* mark stale flag
* optionally send reminder
* surface to operator dashboard

---

# 15. Decline logic

## 15.1 Decline reasons

Decline should always have a structured reason.

Suggested v1 decline reasons:

* rule mismatch
* missing information
* operator decision
* no longer available
* lead unresponsive
* duplicate lead
* prospect withdrew

## 15.2 Decline behavior

When declined:

* status = `declined`
* fit remains current for audit history
* active automation stops
* timeline records reason and actor
* optional decline message may be sent

## 15.3 Soft decline vs final decline

The system may support:

* soft decline = hidden from active funnel but reversible
* final decline = no further automation, closed workflow

v1 can treat all declines as soft declines internally.

---

# 16. Stale lead logic

## 16.1 Staleness detection

A lead becomes stale when:

* no response after configured follow-up window
* no operator action for configured duration
* application invite not used within configured duration

## 16.2 Stale outcomes

Possible stale actions:

* mark as stale
* queue reminder
* queue archive suggestion
* move to archived after policy threshold

---

# 17. Property assignment logic

## 17.1 Direct assignment

A lead may be directly assigned to a property by:

* source context
* inquiry metadata
* manual operator selection

## 17.2 Unassigned leads

If property cannot be determined:

* lead remains unassigned
* qualification cannot fully proceed
* operator must assign property

## 17.3 Reassignment

If a lead is reassigned to another property:

* existing qualification answers are retained
* fit result must be recomputed against the new property’s rules
* activity event records reassignment

---

# 18. Manual review logic

## 18.1 Review queue triggers

Lead enters review queue when:

* duplicate uncertainty exists
* caution rule triggered
* conflicting answers detected
* low-confidence extraction exists
* blocking mismatch exists but auto-decline is off

## 18.2 Operator review actions

From review state, operator may:

* confirm qualification
* request more info
* decline
* override fit result
* reassign property
* schedule tour

---

# 19. Activity timeline rules

Every material action must create an immutable timeline event.

## 19.1 Event examples

* lead_created
* inquiry_received
* lead_matched
* duplicate_flagged
* qualification_started
* question_sent
* answer_received
* fit_computed
* warning_triggered
* mismatch_triggered
* operator_overrode_fit
* status_changed
* tour_scheduled
* application_sent
* decline_recorded
* archived

## 19.2 Audit requirements

Every event should capture:

* event type
* lead id
* actor type (system/user)
* actor id if user
* old state if applicable
* new state if applicable
* metadata payload
* timestamp

---

# 20. Permissions and role logic

## 20.1 Owner

Can manage all workspace settings, billing, users, properties, templates, and lead actions.

## 20.2 Admin

Can manage operational settings, properties, leads, templates, and team workflows, but not billing ownership transfer.

## 20.3 Manager

Can handle leads, messages, tours, and property-level workflows, but not high-level account/billing changes.

## 20.4 Viewer

Read-only access to assigned views.

---

# 21. Notification logic

System notifications may be triggered for:

* new lead created
* caution lead requires review
* mismatch found
* stale lead reminder
* tour scheduled
* application invite stale

Notification destinations may include:

* in-app
* email
* future SMS or webhook

---

# 22. Integrations logic

## 22.1 Inbound source integrations

Supported source types in conceptual v1:

* email inbox
* SMS provider
* manual entry
* CSV import
* web form

Each source must define:

* source label
* source type
* parsing behavior
* default property assignment behavior
* active flag

## 22.2 Calendar integration

If calendar sync is enabled:

* tours create synced events
* reschedules update synced events
* cancellations preserve internal audit trail

## 22.3 Webhook behavior

Key workflow changes may emit webhooks in later phases.

Potential triggers:

* lead created
* lead qualified
* lead declined
* application invite sent
* tour scheduled

---

# 23. Billing and usage logic

For initial planning, billing is based on workspace subscription.

Possible usage axes:

* active properties
* active leads per month
* automation volume
* seats

v1 business logic should not hard-wire billing enforcement into operational flows.
Instead:

* log usage counters
* surface plan limits
* allow soft warnings before hard blocks

---

# 24. Error and exception handling logic

## 24.1 Missing channel

If no valid channel exists for follow-up:

* do not attempt automation
* move lead to `under_review` or `incomplete`
* create operator task indicator

## 24.2 Invalid answer format

If a lead provides an invalid answer:

* keep prior valid value
* mark response as unparsed or invalid
* optionally send clarification prompt

## 24.3 Conflicting answers

If later answers conflict with prior answers:

* preserve both in history
* mark field as conflicted
* require recomputation of fit
* surface conflict to operator

## 24.4 Template render failure

If a template cannot render safely:

* abort automated send
* create internal error event
* notify operator if needed

---

# 25. Default automation policy for v1

Suggested v1 automation behavior:

* auto-create lead from inbound inquiry
* auto-extract obvious fields
* auto-send missing question template once
* auto-compute fit when sufficient answers exist
* auto-route pass leads to `qualified`
* auto-route caution leads to `under_review`
* auto-route mismatch leads to `under_review` by default
* require operator action for decline, tour scheduling, and application invite

This keeps the system useful without making overly aggressive decisions.

---

# 26. Minimal state machine for implementation

## 26.1 Status state machine

Allowed baseline transitions:

* `new` -> `awaiting_response`
* `new` -> `under_review`
* `awaiting_response` -> `incomplete`
* `awaiting_response` -> `under_review`
* `awaiting_response` -> `qualified`
* `incomplete` -> `awaiting_response`
* `incomplete` -> `under_review`
* `under_review` -> `qualified`
* `under_review` -> `declined`
* `under_review` -> `tour_scheduled`
* `qualified` -> `tour_scheduled`
* `qualified` -> `application_sent`
* `qualified` -> `declined`
* `tour_scheduled` -> `qualified`
* `tour_scheduled` -> `application_sent`
* `application_sent` -> `closed`
* any active state -> `archived`
* any non-final state -> `declined`

## 26.2 Fit recomputation triggers

Recompute fit when:

* a required answer changes
* a blocking or warning rule changes
* property assignment changes
* operator overrides or confirms a conflicted answer

---

# 27. KPI logic

Operational metrics should be derived from workflow events.

Suggested v1 KPIs:

* leads created by source
* average time to first response
* qualification completion rate
* pass / caution / mismatch distribution
* inquiry to tour conversion
* inquiry to application conversion
* average time in each status
* decline reason distribution

---

# 28. Guiding implementation principles

## 28.1 Keep operator control

Roomflow should assist decisions, not replace operator judgment.

## 28.2 Separate status from fit

Do not collapse workflow state and compatibility interpretation into one field.

## 28.3 Preserve history

Never overwrite critical history without audit logging.

## 28.4 Prefer explicit state transitions

All workflow moves should be traceable.

## 28.5 Keep v1 deterministic

Business logic should be rule-based first.
Use AI to extract and assist, not to silently decide.

---

# 29. Recommended first implementation slices

Build the logic in this order:

## Slice 1

* lead creation
* inquiry normalization
* property assignment
* status field
* activity timeline

## Slice 2

* qualification questions
* answer storage
* missing-answer detection
* follow-up trigger

## Slice 3

* house rules
* fit computation
* review routing
* operator override

## Slice 4

* templates
* outbound communication controls
* tour scheduling
* application invite

## Slice 5

* stale lead handling
* analytics derivation
* notifications

---

# 30. Summary

Roomflow’s core workflow logic is:

1. Capture the inquiry
2. Normalize the lead
3. Ask what is missing
4. Evaluate fit against explicit property rules
5. Route the lead into a small number of operational states
6. Keep the operator in control
7. Record every meaningful step

That gives the product a clean foundation for implementation and future expansion.
