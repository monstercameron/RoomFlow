# Roomflow — AI Product Specification

This document defines the concrete product specification for **AI features in Roomflow**.

The goal is to make AI a practical part of the product in a way that:

* improves the operator workflow
* creates monetizable premium features
* supports top-of-funnel acquisition through public tools
* avoids unsafe or overly aggressive housing decision automation

---

# 1. Purpose

Roomflow is a post-inquiry workflow system for room-rental and shared-housing leads.

The AI layer exists to help operators:

* turn messy inquiry text into structured lead data
* identify missing qualification information
* draft good follow-up messages
* summarize conversations quickly
* explain rule conflicts clearly
* prioritize next actions

The AI layer does **not** exist to:

* make final tenant approval decisions
* score applicants in a black-box manner
* infer protected personal traits
* automate legal eligibility determinations

---

# 2. Product goals

## 2.1 Primary goals

1. Reduce manual inbox work
2. Improve speed to first useful response
3. Increase consistency of the qualification process
4. Reduce time spent reading message threads
5. Improve operator confidence in lead handling
6. Create a premium feature set worth paying for

## 2.2 Secondary goals

1. Create public AI tools that drive traffic to Roomflow
2. Use AI as a product differentiator for shared housing
3. Build operator trust through explainable outputs

---

# 3. AI product principles

## 3.1 Assist, do not decide

AI should support the operator workflow, not replace operator judgment.

## 3.2 Structured outputs over chat novelty

The best AI features should produce usable structured workflow data, not just paragraphs.

## 3.3 Explainability over magic

Every meaningful AI recommendation should include clear reasons.

## 3.4 Conservative automation

AI automation should be opt-in and bounded.

## 3.5 Human-in-the-loop by default

The operator stays in control of declines, overrides, tour scheduling, and application advancement.

## 3.6 Shared-housing specialization

AI should be tuned to the realities of room rentals and shared-house rules.

---

# 4. Feature set overview

The AI system is divided into three layers:

## 4.1 Core AI workflow features

These improve the paid product directly.

* Inquiry-to-profile extraction
* Missing-info detection
* Message drafting
* Lead summary generation
* Rule conflict explanation
* Duplicate lead suggestion
* Translation and language assistance
* Next-best-action suggestion

## 4.2 Premium AI automation features

These become upsell features.

* Auto-follow-up drafting and sending
* Auto-summary refresh
* AI-assisted routing suggestions
* Weekly funnel analysis narratives
* Portfolio-level source and rules analysis

## 4.3 Public AI acquisition tools

These generate inbound traffic and funnel users into Roomflow.

* Room Rental Reply Generator
* House Rules Generator
* Lead Intake Form Builder
* Listing Analyzer

---

# 5. Personas

## 5.1 Owner-occupant landlord

Needs fast, simple help replying to room inquiries and filtering poor fits.

## 5.2 Small room-rental operator

Needs multi-lead organization, repeated workflow automation, and less repetitive messaging.

## 5.3 Co-living manager

Needs consistency across properties and staff plus better lead review speed.

## 5.4 Prospect operations assistant

Needs summarized threads, clear house-rule conflicts, and suggested next steps.

---

# 6. Core AI features

---

## 6.1 Inquiry-to-profile extraction

### Goal

Convert unstructured lead messages into structured lead fields.

### Inputs

* inbound message text
* source channel
* optional thread history
* assigned property context
* property rules
* existing lead record

### Outputs

Structured extracted fields such as:

* name
* move-in date
* budget
* intended stay length
* smoking status
* pet status
* parking need
* bathroom-sharing acceptance
* guest expectations
* work status or schedule
* general notes

Each output field should include:

* extracted value
* confidence score
* evidence snippet
* source message reference

### Success criteria

* operator can review extracted fields quickly
* obvious data entry work is reduced
* extracted fields do not silently overwrite confirmed fields without review

### UI surfaces

* inbox right rail
* lead detail page
* extraction review card

### Operator actions

* accept field
* reject field
* edit field
* mark field as confirmed

### Business rules

* only fill empty fields automatically at high confidence
* never auto-overwrite confirmed values
* conflicting later answers create a conflict flag

---

## 6.2 Missing-info detection

### Goal

Identify which required qualification fields are still missing.

### Inputs

* property question set
* current lead field values
* current qualification answers
* property rules

### Outputs

* missing required fields list
* missing optional but useful fields list
* ranked order of follow-up questions to ask next

### Success criteria

* operator sees clearly what is still needed
* follow-up messages ask only relevant missing questions

### UI surfaces

* lead detail page
* inbox side rail
* follow-up composer

### Business rules

* required questions block qualification completion
* optional questions never block qualification
* do not ask questions already answered unless conflict exists

---

## 6.3 AI message drafting

### Goal

Draft high-quality operator messages for common lead workflow steps.

### Message types

* first reply
* missing-information follow-up
* reminder
* tour confirmation
* application invite
* decline note
* clarification question

### Inputs

* message type
* lead details
* property details
* house rules
* missing fields
* operator tone preference
* selected template if applicable

### Outputs

* ready-to-edit draft
* short version
* more formal version
* friendly version (optional)

### Success criteria

* operator edits are minimal
* replies are context-aware and not generic
* important house rules are represented clearly

### UI surfaces

* composer drawer
* template editor
* one-click draft action from lead detail

### Business rules

* AI drafts are suggestions unless auto-send is explicitly enabled
* draft must never include unresolved placeholders
* decline language must remain polite and neutral

---

## 6.4 Lead summary generation

### Goal

Reduce the time required to understand a lead and conversation thread.

### Inputs

* full thread history
* extracted lead profile
* qualification answers
* fit result
* activity timeline

### Outputs

A summary with:

* who the prospect is
* what they want
* what is missing
* current fit concerns
* latest activity
* recommended next step

### Summary types

* short summary
* detailed summary
* timeline recap

### Success criteria

* operator can understand lead status in seconds
* summary stays updated as thread changes

### UI surfaces

* lead detail header card
* inbox preview
* dashboard recent activity panel

### Business rules

* summary must reference current state, not stale history alone
* summary should surface uncertainty explicitly

---

## 6.5 Rule conflict explanation

### Goal

Explain why a lead is flagged as caution or mismatch.

### Inputs

* lead answers
* property rules
* fit evaluation result

### Outputs

Examples:

* This lead appears to conflict with your no-smoking rule.
* Bathroom-sharing acceptance is unclear.
* Intended stay length may not meet your preferred minimum.

### Success criteria

* operator can understand issues without digging manually
* caution and mismatch results feel explainable, not magical

### UI surfaces

* lead summary card
* fit result panel
* review queue

### Business rules

* explanation references explicit rule categories
* explanation should be framed as workflow guidance, not legal qualification language

---

## 6.6 Duplicate lead suggestion

### Goal

Suggest likely duplicate leads across channels.

### Inputs

* name
* email
* phone
* source history
* thread content similarity
* move-in timing and budget similarity

### Outputs

* likely duplicate suggestion
* confidence level
* merge candidate panel

### Success criteria

* operators reduce duplicate work
* false merges are avoided

### UI surfaces

* lead creation alerts
* inbox duplicate warning banner
* merge modal

### Business rules

* AI can suggest merge, but operator confirms merge
* merged records preserve history from all sources

---

## 6.7 Translation and language assistance

### Goal

Support operators and prospects across multiple languages.

### Inputs

* inbound message text
* selected operator language
* target response tone

### Outputs

* translated inbound text
* translated outbound draft
* language detection label

### Success criteria

* operator can process leads regardless of original message language
* outbound messages remain clear and professional

### UI surfaces

* inbox thread
* composer
* lead detail panel

### Business rules

* original text must remain available
* translated content must be clearly marked as translated

---

## 6.8 Next-best-action suggestion

### Goal

Recommend the most useful next workflow step.

### Possible suggested actions

* ask missing questions
* review caution flags
* schedule tour
* send application invite
* decline politely
* archive stale lead

### Inputs

* lead status
* fit result
* answer completeness
* activity age
* prior operator actions

### Outputs

* recommended action label
* short reason

### Success criteria

* operators spend less time deciding what to do next
* stale or incomplete leads are surfaced more consistently

### UI surfaces

* lead header action bar
* dashboard task list
* inbox side panel

### Business rules

* suggestion is advisory unless operator enables automation
* suggestion must cite workflow reasons

---

# 7. Premium AI features

---

## 7.1 AI Assist plan

This is the first premium AI tier.

### Included capabilities

* inquiry extraction
* lead summaries
* message drafts
* rule explanations
* translation
* next-best-action suggestions

### Buyer value

* saves time immediately
* easy to understand
* low perceived risk
* does not require full automation trust

---

## 7.2 AI Autopilot plan

This is the second premium AI tier.

### Included capabilities

* automated missing-question follow-up
* auto-summary refresh
* optional automated reminder sending
* AI-suggested routing with operator approval gates
* stale lead nudges

### Buyer value

* reduces manual repetition further
* gives small operators lightweight automation without a full assistant team

### Safeguards

* opt-in only
* per-property automation settings
* daily message caps
* manual approval for declines and application invites by default

---

## 7.3 AI Ops Intelligence plan

This is the analytics-heavy premium tier.

### Included capabilities

* weekly AI funnel summary
* decline reason narratives
* source quality observations
* lead quality trend explanations
* rule friction analysis
* top unanswered question analysis

### Buyer value

* better portfolio insight
* stronger operator decision support
* useful for growing teams and multi-property workflows

---

# 8. Public AI acquisition tools

These tools are public-facing, indexable, and designed to convert visitors into Roomflow users.

---

## 8.1 Room Rental Reply Generator

### Goal

Help landlords respond better to inbound room-rental inquiries.

### User flow

1. Visitor pastes inquiry text
2. Visitor optionally selects house rules or property facts
3. Tool generates:

   * reply draft
   * missing questions
   * stronger follow-up version
   * polite decline version
4. Visitor sees CTA to save and automate this inside Roomflow

### Why it matters

This is the closest free-tool mirror of the paid workflow.

### SEO / funnel angle

Targets queries such as:

* how to respond to room rental inquiries
* room rental reply template
* how to prescreen room renters

---

## 8.2 House Rules Generator

### Goal

Help landlords generate a starting set of room-rental house rules.

### User flow

1. Visitor answers guided property questions
2. Tool produces:

   * house rules list
   * listing-safe version
   * move-in acknowledgment version
3. Visitor sees CTA to use these rules for lead qualification in Roomflow

### Why it matters

This turns a painful blank-page problem into a useful artifact and maps directly to the product’s rule engine.

---

## 8.3 Lead Intake Form Builder

### Goal

Help landlords generate a smart prescreening questionnaire.

### User flow

1. Visitor selects property constraints
2. Tool outputs:

   * recommended intake questions
   * email version
   * SMS version
   * form version
3. CTA promotes managing the workflow in Roomflow

---

## 8.4 Listing Analyzer

### Goal

Help landlords improve room listings to reduce bad-fit inquiries.

### User flow

1. Visitor pastes listing text
2. Tool analyzes:

   * clarity
   * missing expectations
   * house-rule visibility
   * likely confusion points
3. Tool outputs rewrite suggestions and CTA

---

# 9. AI system boundaries and safety

## 9.1 Prohibited AI behaviors

The AI system must not:

* generate final approval or denial decisions automatically by default
* infer protected classes
* rank tenants using hidden logic
* make legal claims about compliance
* rewrite communications in a discriminatory manner

## 9.2 Allowed AI behaviors

The AI system may:

* summarize
* extract fields
* draft messages
* explain rule conflicts
* suggest operator actions
* highlight missing information

## 9.3 Human review requirements

Human review is required by default for:

* declines
* override of mismatch logic
* application invite automation
* any ambiguous extraction conflict

---

# 10. User stories

## 10.1 Owner-occupant landlord

As a landlord renting out a room in my home,
I want AI to read incoming inquiry messages and tell me what is missing,
so I can stop asking the same questions manually.

## 10.2 Small operator

As a small operator managing multiple room-rental properties,
I want AI to summarize each lead and explain rule conflicts,
so I can review leads faster.

## 10.3 Leasing assistant

As a person handling inbound messages,
I want AI to draft replies and reminders,
so I can respond quickly without writing every message from scratch.

## 10.4 Growing team

As a portfolio operator,
I want AI to show me why leads are failing or stalling,
so I can improve our process.

---

# 11. UX specification

## 11.1 Inbox AI surfaces

* extraction side panel
* summary card
* draft reply action
* duplicate warning banner
* next-best-action widget

## 11.2 Lead detail AI surfaces

* top summary card
* fit explanation panel
* missing-info checklist
* AI-generated reply buttons
* operator review section

## 11.3 Dashboard AI surfaces

* review queue summary
* stale lead suggestions
* weekly AI insights card

## 11.4 Public site AI surfaces

* free-tool landing pages
* result output panels
* CTA banner to create account

---

# 12. Data model implications

AI-related data objects should include:

* AI extraction result
* field evidence snippet
* extraction confidence
* AI summary version
* AI draft message
* AI recommendation
* AI explanation record
* AI usage log
* model metadata

Each generated output should store:

* model name
* prompt version
* output payload
* confidence or reasoning metadata if applicable
* timestamp
* actor type = system

---

# 13. Prompting and generation patterns

## 13.1 Extraction prompts

Use structured output prompts that map directly to schema fields.

## 13.2 Drafting prompts

Use property context, house rules, tone settings, and missing-info context.

## 13.3 Summary prompts

Use thread history plus lead state, fit result, and open items.

## 13.4 Explanation prompts

Use explicit triggered rules and actual answer evidence.

## 13.5 Guardrails

Every generation path must:

* avoid legal approval language
* avoid discriminatory wording
* avoid fictional details
* preserve uncertainty where present

---

# 14. Automation controls

## 14.1 Workspace-level controls

* AI enabled on/off
* model provider setting
* public tool branding setting
* default automation posture

## 14.2 Property-level controls

* auto-follow-up enabled
* auto-reminder enabled
* auto-suggested routing enabled
* translation enabled

## 14.3 Operator-level controls

* tone preference
* approval required before send
* default summary length

---

# 15. Pricing and packaging

## 15.1 Base plan

No AI or limited AI credits.

## 15.2 AI Assist add-on

Includes extraction, summaries, drafts, explanations, translation, and suggestions.

## 15.3 AI Autopilot add-on

Includes automation features such as follow-ups and reminders.

## 15.4 AI Ops Intelligence add-on

Includes AI-generated analytics and weekly operational reports.

---

# 16. Success metrics

## 16.1 Product metrics

* extraction acceptance rate
* draft usage rate
* summary open rate
* suggestion adoption rate
* auto-follow-up completion rate

## 16.2 Business metrics

* AI plan attach rate
* free tool to signup conversion rate
* free tool to paid conversion rate
* average revenue per workspace with AI enabled

## 16.3 Workflow metrics

* reduced time to first response
* reduced manual messages per lead
* improved qualification completion rate
* reduced stale lead count

---

# 17. Rollout plan

## Phase 1

Core AI workflow helpers:

* extraction
  n- missing-info detection
* summaries
* message drafting
* rule explanations

## Phase 2

Public funnel tools:

* Room Rental Reply Generator
* House Rules Generator

## Phase 3

Premium automation:

* auto-follow-ups
* reminders
* next-best-action suggestions
* duplicate suggestions

## Phase 4

Portfolio intelligence:

* weekly AI summaries
* funnel narratives
* source and rule analytics

---

# 18. Recommended initial implementation order

Build in this order:

1. Inquiry-to-profile extraction
2. Missing-info detection
3. AI reply drafting
4. Lead summary generation
5. Rule conflict explanation
6. Public Room Rental Reply Generator
7. Translation support
8. Duplicate suggestion
9. Next-best-action suggestions
10. Autopilot follow-ups
11. AI Ops Intelligence

---

# 19. Recommended v1 feature cut

If the AI launch must stay tight, ship only:

* extraction
* missing-info detection
* reply drafting
* lead summary
* Room Rental Reply Generator

This gives:

* immediate in-product value
* obvious premium potential
* one strong public acquisition tool
* low-risk AI positioning

---

# 20. Summary

Roomflow’s AI layer should be defined as:

**AI for structuring, summarizing, drafting, and explaining shared-housing lead workflows.**

That is the safest, clearest, and most monetizable AI product direction for the business.
