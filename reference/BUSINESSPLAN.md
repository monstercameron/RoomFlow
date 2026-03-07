# Roomflow — Pricing and Plan Bifurcation Specification

This document defines the pricing model, plan structure, feature bifurcation, usage limits, upgrade logic, and billing principles for Roomflow.

The goal is to create a pricing system that is:

* simple to understand
* aligned to real customer types
* consistent with the product thesis
* easy to implement in code and billing logic
* capable of expanding over time without confusing early users

---

# 1. Pricing philosophy

Roomflow should not be priced like a generic all-in-one landlord tool.

The product is not primarily:

* rent collection software
* accounting software
* generic PM software
* a free listing portal

Roomflow is primarily:

* an AI-powered room-rental lead workflow system
* a post-inquiry qualification and routing platform
* a communications and integrations layer for shared-housing operations

Pricing should reflect that positioning.

The pricing model should optimize for:

* clear value communication
* low decision friction
* strong expansion path
* healthy margins on communications and AI usage
* simple buyer segmentation

---

# 2. Core pricing decision

Roomflow will use a **two-plan model** based on customer type:

* **Personal**
* **Org**

AI is included in both plans.

This is a deliberate departure from a traditional 3-tier SaaS ladder.

The reason is that the strongest product distinction is not “small / medium / large feature bundle.”
It is:

* solo operator workflow
* organization / team workflow

The pricing model should therefore map to the customer’s operating structure.

---

# 3. Plan definitions

## 3.1 Personal plan

### Positioning

For a solo landlord, house hacker, owner-occupant, or small independent operator managing room-rental leads alone.

### Product promise

An AI-powered personal operating system for qualifying and managing room-rental inquiries.

### Target buyers

* owner-occupants renting 1 or more rooms
* house hackers
* solo landlords
* solo room-rental operators
* individuals testing Roomflow before scaling into a small team

### Buyer mindset

* "Help me stop losing track of leads."
* "Help me ask better questions faster."
* "Help me screen for house-rule fit without doing everything manually."

---

## 3.2 Org plan

### Positioning

For teams, portfolios, co-living operators, PM companies, or any organization running a shared lead workflow across multiple users and properties.

### Product promise

An AI-powered team operating platform for room-rental lead intake, qualification, communications, integrations, and workflow control.

### Target buyers

* co-living operators
* PM firms with room-rental inventory
* landlords with a growing portfolio
* small operations teams
* businesses that need integrations, controls, and auditability

### Buyer mindset

* "Help my team work from one system."
* "Help us standardize lead handling."
* "Help us connect inboxes, calendars, lead sources, and screening providers."
* "Help us scale our workflow without chaos."

---

# 4. AI inclusion policy

AI is included in both Personal and Org.

This is a product-level positioning decision.

Roomflow should be presented as:

**an AI-powered workflow system**

not:

**a normal workflow product with optional AI bolted on later**

## 4.1 Personal AI posture

Personal includes practical, operator-facing AI helpers.

## 4.2 Org AI posture

Org includes the same core AI helpers, plus deeper automation, higher usage limits, and organization-scale intelligence.

## 4.3 Billing implication

AI should not be a standalone plan gate.
Instead, AI differences should be expressed through:

* usage limits
* automation depth
* team/portfolio intelligence
* advanced workflow controls

---

# 5. Recommended price points

These are the recommended initial launch prices.

## 5.1 Personal

**$59/month**

## 5.2 Org

**$179/month**

These values are high enough to support:

* AI usage
* messaging infrastructure
* healthy software margins
* a specialized workflow position

They are also simple enough to explain.

---

# 6. Usage-based billing components

Roomflow should not attempt to bury every variable cost inside flat pricing.

Certain usage dimensions should be handled as either included allowances plus overage, or pass-through.

## 6.1 Included in base price

Included usage should cover normal product use for the plan.

Examples:

* basic AI usage
* core email notifications
* standard platform activity

## 6.2 Metered / overage-friendly items

These should be usage-sensitive because they map to direct cash cost.

### SMS usage

Charge by included allowance plus overage.

### WhatsApp usage

Charge by included allowance plus overage or provider pass-through.

### High AI usage above included threshold

Optional later. Not required at launch, but useful if some customers become heavy users.

## 6.3 Pass-through items

These should not be hidden inside the SaaS plan.

### Screening / background checks

Pass-through to customer or applicant via provider pricing.

### Certain partner-gated listing or syndication services

May later involve setup or service fees.

---

# 7. Plan comparison principles

The bifurcation between Personal and Org should be based on:

* who uses the product
* how many people use it
* how many properties are managed
* what integrations are needed
* what operational control is required

The split should **not** rely on arbitrary feature crippling.

Personal must still feel like a complete useful product.

Org must feel like a genuine step up for real business operations.

---

# 8. Personal feature scope

## 8.1 Included capabilities

Personal should include:

* 1 user
* 1 workspace
* lead inbox
* lead list and detail views
* qualification workflow
* house rules
* qualification questions
* templates
* email communication support
* manual lead import
* basic source tagging
* basic dashboard
* AI extraction
* AI missing-info detection
* AI summaries
* AI reply drafting
* AI rule conflict explanations

## 8.2 Suggested limits

Personal should have clear but not insulting limits.

Recommended launch limits:

* users: 1
* properties: up to 3
* active leads per month: soft cap or fair-use posture
* calendar connections: 1
* integrations: limited to core communication channels
* AI usage: standard included usage allowance

## 8.3 Excluded or deferred capabilities

Personal should not include the advanced org workflow layer.

Examples:

* multiple users
* advanced role permissions
* advanced audit logs
* screening provider integrations
* listing feed / syndication integrations
* webhook/API access
* shared inbox assignment controls
* portfolio AI insights
* advanced automations

---

# 9. Org feature scope

## 9.1 Included capabilities

Org should include everything in Personal, plus:

* multiple users
* role-based access control
* multiple properties
* shared team workflow
* advanced inbox routing / assignment
* shared calendar workflows
* SMS support
* Google Calendar integration
* advanced automations
* webhooks / API access
* screening provider integrations
* listing feed / source integrations
* organization settings
* advanced analytics
* audit log
* higher AI usage allowance
* AI next-best-action guidance
* AI workflow recommendations
* portfolio-level AI insights

## 9.2 Suggested limits

Recommended launch posture:

* users: included seat bundle or workspace-level included seats
* properties: materially higher than Personal
* integrations: advanced integrations enabled
* AI usage: expanded allowance
* automations: enabled
* workspaces: 1 org workspace

## 9.3 Expansion posture

Org can later expand through:

* extra seats
* extra property bundles
* premium integration packages
* enterprise implementation / partner onboarding

---

# 10. Precise feature bifurcation matrix

This section defines the intended gating.

## 10.1 Workspace and identity

* Single user: Personal
* Multi-user: Org
* Roles and permissions: Org
* Team assignment workflow: Org

## 10.2 Properties

* Limited properties: Personal
* Portfolio / many properties: Org
* Property-level routing and assignment controls: Org

## 10.3 Lead workflow

* Lead inbox: both
* Qualification workflow: both
* House rules: both
* Templates: both
* Manual lead import: both
* Shared team queue: Org
* Advanced routing rules: Org

## 10.4 Communications

* Email: both
* Basic communication logs: both
* SMS: Org by default, or optional add-on later if you want a hybrid model
* WhatsApp: Org
* Shared communications controls: Org
* Automation throttles and advanced messaging controls: Org

## 10.5 Calendar and scheduling

* Basic scheduling workflow: Personal can support manual/internal scheduling
* Calendar integration: Org
* Multi-calendar/team scheduling: Org

## 10.6 Integrations

* Basic integrations: Personal (light)
* Advanced integrations: Org
* Webhooks/API: Org
* Lead ads/social connectors: Org
* Listing feed connectors: Org
* Screening provider integrations: Org

## 10.7 AI

* AI extraction: both
* AI summaries: both
* AI drafting: both
* AI conflict explanations: both
* AI translation: both or Org-first depending launch scope
* AI next-best-action: Org
* AI automations: Org
* Portfolio AI insights: Org
* team-level operational AI: Org

## 10.8 Reporting and analytics

* Basic dashboard: Personal
* advanced analytics: Org
* portfolio/source analytics: Org
* audit logs: Org

---

# 11. Recommended hard limits for launch

These are practical launch defaults.

## 11.1 Personal launch limits

* 1 user
* up to 3 properties
* 1 calendar connection
* core email support
* no advanced integrations
* no screening integrations
* no webhooks/API
* standard included AI allowance

## 11.2 Org launch limits

* up to 5 users included
* up to 25 properties included
* shared workflows enabled
* advanced integrations enabled
* screening integrations enabled
* webhooks/API enabled
* expanded AI allowance

These numbers can be tuned later, but this is a reasonable initial shape.

---

# 12. Upgrade triggers

Upgrade logic should be obvious and natural.

A customer should upgrade from Personal to Org when they need:

* another user
* more operational control
* more than a few properties
* SMS and communication automation at scale
* calendar integrations
* screening providers
* listing/source integrations
* webhooks/API
* organization-level AI insights

The UI should detect upgrade triggers and present them contextually.

Examples:

* user tries to invite teammate
* user tries to connect screening provider
* user exceeds property limit
* user tries to enable advanced automation
* user tries to configure webhooks

---

# 13. Downgrade logic

Downgrade behavior must be predictable.

If an Org customer downgrades to Personal:

* additional users become inactive
* advanced integrations become disconnected or read-only
* Org-only workflows are disabled
* historical data remains accessible unless there is a clear archival policy
* properties above the Personal limit become inactive or require selection of active subset

The product should never silently destroy data on downgrade.

---

# 14. Billing and subscription logic

## 14.1 Billing interval

Launch with:

* monthly billing
* annual billing optional later

## 14.2 Subscription object model

Each workspace should have:

* plan type
* billing status
* billing cycle
* active limits
* usage counters
* overage counters if applicable

## 14.3 Grace periods

If payment fails:

* soft grace period
* read-only fallback after grace if unresolved
* no immediate hard deletion

## 14.4 Trial posture

Recommended launch posture:

* 14-day free trial
* no forever-free plan

Rationale:
Roomflow should position itself as a specialized paid tool, not a free utility.

---

# 15. Overage model

## 15.1 SMS overage

Both plans should use explicit SMS metering if SMS is enabled.

Suggested policy:

* include a small allowance where applicable
* charge per-message or bundled overage beyond included amount

## 15.2 AI overage

At launch, AI can be governed under fair use or a generous allowance.
Later, if needed:

* add extra AI credits
* add soft usage warnings
* add overage billing for heavy users

## 15.3 Screening costs

Screening should remain pass-through.

Suggested policy:

* billed by screening provider or passed through to workspace/applicant
* Roomflow tracks the workflow, not the raw screening economics

---

# 16. Internal billing logic recommendations

The internal plan model should support more flexibility than the public pricing page initially shows.

Recommended internal fields:

* plan_code
* plan_type
* included_users
* included_properties
* included_calendar_connections
* included_ai_credits
* included_sms_messages
* integrations_enabled
* screening_enabled
* webhooks_enabled
* audit_log_enabled
* advanced_automation_enabled
* org_ai_enabled

This allows future pricing changes without major schema redesign.

---

# 17. Monetization philosophy

Roomflow should make money from:

* subscription plan value
* organization-level feature depth
* usage-sensitive communication channels
* premium integration enablement over time

Roomflow should not depend primarily on:

* nickel-and-diming basic workflow actions
* hiding AI completely behind a separate product
* forcing confusing upgrade ladders

The revenue model should feel clean, not tricky.

---

# 18. Public pricing page framing

The public pricing page should explain plans in customer-language.

## 18.1 Personal framing

**For solo landlords and room-rental operators**

Suggested bullets:

* 1 user
* up to 3 properties
* AI-powered lead qualification
* inbox, rules, templates, and follow-up workflow
* email support

## 18.2 Org framing

**For teams, portfolios, and growing operations**

Suggested bullets:

* up to 5 users included
* multi-property workflow
* shared inbox and team controls
* advanced integrations
* screening and calendar workflows
* deeper AI automation and insights

## 18.3 Positioning statement

Use language like:

**Both plans include AI. Org adds scale, automation, team workflows, and advanced integrations.**

This keeps the message simple.

---

# 19. Recommended implementation order

## Step 1

Implement plan model with:

* Personal
* Org
* limit enforcement framework

## Step 2

Implement feature flags for:

* multi-user
* integrations
* webhooks
* audit log
* screening
* advanced AI features

## Step 3

Implement usage counters for:

* properties
* users
* SMS
* AI

## Step 4

Implement upgrade prompts and billing pages.

## Step 5

Implement downgrade-safe behaviors.

---

# 20. Future pricing expansion

The two-plan structure should be the public launch model, but the architecture should allow future extensions.

Potential future additions:

* annual discounting
* enterprise plan
* extra seat bundles
* extra property bundles
* premium onboarding / migration services
* premium partner integrations

These should be layered on later only if demand justifies complexity.

---

# 21. Summary

Roomflow pricing should be built around a simple bifurcation:

## Personal

A complete AI-powered solo workflow product.

## Org

A complete AI-powered team and portfolio operations platform.

The main distinction is not whether AI exists.
The distinction is:

* scale
* people
* integrations
* controls
* automation depth

Recommended launch pricing:

* **Personal: $59/month**
* **Org: $179/month**

Recommended usage posture:

* include AI in both
* meter SMS where needed
* treat screening as pass-through

This creates a pricing structure that is easier to understand, easier to sell, and better aligned with the actual product strategy.
