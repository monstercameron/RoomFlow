# Roomflow — Sitemap and Basic Page Templates

This document defines the **initial sitemap**, **route structure**, and **basic page templates** for the first version of Roomflow.

The goal is to start with a narrow, usable B2B SaaS for **shared-housing inquiry qualification**.

---

## Product scope for v1

Roomflow v1 is a workflow layer for landlords and small operators who receive room-rental leads from listing sites and need to:

* capture inbound inquiries
* ask missing questions
* evaluate house-rule fit
* organize leads
* route prospects to the correct next step

Roomflow v1 is **not**:

* a marketplace
* a rent collection app
* a lease management suite
* a tenant screening bureau
* a full PM platform

---

# 1. Sitemap overview

## Public / marketing

* `/`
* `/features`
* `/how-it-works`
* `/pricing`
* `/about`
* `/contact`
* `/login`
* `/signup`

## Auth / onboarding

* `/signup`
* `/login`
* `/forgot-password`
* `/reset-password`
* `/verify-email`
* `/onboarding`
* `/onboarding/property`
* `/onboarding/house-rules`
* `/onboarding/channels`

## Main app

* `/app`
* `/app/inbox`
* `/app/leads`
* `/app/leads/[leadId]`
* `/app/properties`
* `/app/properties/[propertyId]`
* `/app/properties/[propertyId]/rules`
* `/app/properties/[propertyId]/questions`
* `/app/templates`
* `/app/calendar`
* `/app/analytics`
* `/app/settings`

## Settings / account

* `/app/settings/profile`
* `/app/settings/account`
* `/app/settings/team`
* `/app/settings/billing`
* `/app/settings/integrations`
* `/app/settings/notifications`

## Optional future pages

* `/app/waitlist`
* `/app/applications`
* `/app/workflows`
* `/app/audit`
* `/app/messages`
* `/app/channels`
* `/app/rooms`

---

# 2. Navigation model

## Public nav

* Home
* Features
* How it Works
* Pricing
* Contact
* Log In
* Start Free

## In-app primary nav

* Dashboard
* Inbox
* Leads
* Properties
* Templates
* Calendar
* Analytics
* Settings

## In-app utility nav

* Search
* Notifications
* Current workspace / property scope
* User menu

---

# 3. Route priority for build order

Build in this order:

## Phase 1 — foundation

* `/`
* `/pricing`
* `/login`
* `/signup`
* `/onboarding`
* `/app`
* `/app/leads`
* `/app/leads/[leadId]`
* `/app/properties`
* `/app/properties/[propertyId]`
* `/app/settings`

## Phase 2 — core workflow depth

* `/app/inbox`
* `/app/properties/[propertyId]/rules`
* `/app/properties/[propertyId]/questions`
* `/app/templates`
* `/app/calendar`

## Phase 3 — optimization

* `/features`
* `/how-it-works`
* `/analytics`
* `/app/settings/integrations`
* `/app/settings/billing`

---

# 4. Page templates

---

## 4.1 Home page

**Route:** `/`

**Goal:** explain the product quickly and convert visitors to signup/demo.

### Sections

1. Hero

   * Headline
   * Short subheadline
   * CTA buttons: `Start Free`, `See How It Works`

2. Problem statement

   * scattered inquiries
   * repetitive screening
   * wasted tours
   * weak lead organization

3. How Roomflow works

   * Capture inquiry
   * Ask missing questions
   * Check house-rule fit
   * Route to next step

4. Key benefits

   * faster response
   * fewer wasted showings
   * better-fit leads
   * cleaner documentation

5. Product screenshots / mock panels

6. Simple pricing preview

7. FAQ

8. CTA footer

### Template skeleton

* Header
* Hero
* Feature strip
* Workflow strip
* Benefits grid
* Screenshot band
* Pricing teaser
* FAQ
* Footer

---

## 4.2 Features page

**Route:** `/features`

**Goal:** explain product capabilities in more detail.

### Sections

* Unified lead inbox
* Qualification workflow
* House-rule fit checks
* Property-specific questionnaires
* Templates and follow-ups
* Lead routing
* Audit trail
* Multi-source lead handling

### Template skeleton

* Intro hero
* Feature blocks
* Comparison callout
* CTA

---

## 4.3 How it Works page

**Route:** `/how-it-works`

**Goal:** teach the funnel clearly.

### Sections

1. Lead arrives from listing site
2. Roomflow parses and normalizes it
3. Missing questions are sent
4. Rules are checked
5. Lead is routed
6. Operator reviews result

### Template skeleton

* Intro
* 6-step workflow
* screenshot or diagram area
* CTA

---

## 4.4 Pricing page

**Route:** `/pricing`

**Goal:** offer simple pricing for solo landlords and small operators.

### Starter tiers

* Solo
* Operator
* Portfolio

### Sections

* Pricing cards
* Included features
* FAQ
* CTA

### Template skeleton

* Pricing hero
* Tier cards
* Feature comparison
* FAQ
* CTA footer

---

## 4.5 Login page

**Route:** `/login`

**Goal:** authenticate returning users.

### Elements

* email
* password
* forgot password link
* log in button
* alternative auth options if enabled

### Template skeleton

* centered auth card
* logo
* heading
* form
* secondary links

---

## 4.6 Signup page

**Route:** `/signup`

**Goal:** create new account.

### Elements

* name
* email
* password
* create account button
* terms acceptance

### Template skeleton

* centered auth card
* benefits bullets
* form

---

## 4.7 Onboarding hub

**Route:** `/onboarding`

**Goal:** get the account usable quickly.

### Steps

1. Create first property
2. Add house rules
3. Add default qualification questions
4. Connect lead channels or define intake flow
5. Invite team later (optional)

### Template skeleton

* progress stepper
* onboarding cards
* next action button

---

## 4.8 Property onboarding page

**Route:** `/onboarding/property`

**Goal:** collect the first property configuration.

### Form fields

* property name
* property type
* address or approximate area
* number of rentable rooms
* shared bathroom count
* parking availability
* smoking allowed yes/no
* pets allowed yes/no

### Template skeleton

* title
* single-column form
* save and continue button

---

## 4.9 House rules onboarding page

**Route:** `/onboarding/house-rules`

**Goal:** define operational rules used in qualification.

### Rule examples

* no smoking
* no pets
* no frequent overnight guests
* minimum stay preferred
* shared bathroom required
* quiet hours acknowledgment

### Template skeleton

* rules checklist
* custom rules textarea
* severity or required flag
* save button

---

## 4.10 Channel onboarding page

**Route:** `/onboarding/channels`

**Goal:** define where leads come from and how they enter the system.

### Initial v1 concept

Even if real integrations do not exist yet, allow manual channel setup:

* Facebook Marketplace
* Zillow
* SpareRoom
* Roomster
* Craigslist
* email
* SMS
* manual entry

### Template skeleton

* source cards
* channel descriptions
* setup state badges
* continue button

---

## 4.11 App dashboard

**Route:** `/app`

**Goal:** give the operator a quick operational snapshot.

### Key widgets

* new leads today
* awaiting response
* qualified leads
* tours scheduled
* declined leads
* source performance
* recent lead activity

### Template skeleton

* page header
* KPI cards row
* recent activity list
* upcoming tasks/tours
* source summary

---

## 4.12 Inbox page

**Route:** `/app/inbox`

**Goal:** show inbound messages and unresolved conversations.

### Layout

* left column: conversation list
* center: message thread
* right rail: extracted lead data + qualification status

### Key actions

* mark reviewed
* request missing info
* send template
* link to lead profile
* assign property

### Template skeleton

* three-panel inbox layout

---

## 4.13 Leads list page

**Route:** `/app/leads`

**Goal:** manage all leads in a structured list.

### Table columns

* name
* source
* property
* move-in date
* budget
* status
* fit result
* last activity

### Filters

* source
* property
* status
* fit
* date range

### Template skeleton

* page header
* filter bar
* leads table
* bulk actions placeholder

---

## 4.14 Lead detail page

**Route:** `/app/leads/[leadId]`

**Goal:** serve as the main operating record for one prospect.

### Sections

1. Lead header

   * name
   * status
   * source
   * assigned property

2. Summary card

   * move-in date
   * budget
   * stay length
   * work status
   * contact method

3. Qualification answers

4. House-rule fit result

   * pass
   * caution
   * mismatch
   * unknown

5. Timeline / activity feed

6. Messages

7. Actions

   * request info
   * qualify
   * decline
   * schedule tour
   * send application

### Template skeleton

* header with actions
* two-column content area
* detail cards
* activity timeline

---

## 4.15 Properties list page

**Route:** `/app/properties`

**Goal:** show all managed properties or shared houses.

### Card fields

* property name
* active rooms
* active leads
* qualified leads
* rules count

### Template skeleton

* header
* property cards grid
* add property CTA

---

## 4.16 Property detail page

**Route:** `/app/properties/[propertyId]`

**Goal:** manage one property’s qualification setup and funnel.

### Sections

* property summary
* house rules preview
* default questions preview
* active lead counts
* lead pipeline by status
* recent activity

### Template skeleton

* property header
* overview cards
* rules/questions panels
* funnel section

---

## 4.17 Property rules page

**Route:** `/app/properties/[propertyId]/rules`

**Goal:** manage house-rule logic.

### Rule properties

* label
* description
* category
* required yes/no
* auto-decline yes/no
* warning-only yes/no

### Template skeleton

* rules list
* add/edit drawer or modal
* save controls

---

## 4.18 Property questions page

**Route:** `/app/properties/[propertyId]/questions`

**Goal:** manage the prescreening questionnaire.

### Question types

* text
* select
* yes/no
* number
* date

### Question examples

* move-in date
* budget
* smoking
* pets
* parking needs
* expected stay length
* guest frequency

### Template skeleton

* question list with drag/reorder handle
* question editor panel
* preview state

---

## 4.19 Templates page

**Route:** `/app/templates`

**Goal:** manage reusable messaging.

### Template types

* initial reply
* missing information follow-up
* tour confirmation
* application invite
* decline
* reminder

### Template skeleton

* template list
* template editor
* variable preview

---

## 4.20 Calendar page

**Route:** `/app/calendar`

**Goal:** manage tours and upcoming scheduling actions.

### Views

* agenda
* week
* simple month

### Template skeleton

* calendar header
* view switcher
* event list
* right rail for selected event

---

## 4.21 Analytics page

**Route:** `/app/analytics`

**Goal:** surface funnel performance.

### Metrics

* inquiries by source
* qualification rate
* decline reasons
* tour booking rate
* inquiry-to-tour time
* inquiry-to-application rate

### Template skeleton

* filters
* KPI cards
* charts
* source table

---

## 4.22 Settings hub

**Route:** `/app/settings`

**Goal:** centralize account configuration.

### Sections

* profile
* account
* team
* billing
* integrations
* notifications

### Template skeleton

* settings sidebar
* detail content area

---

## 4.23 Integrations settings page

**Route:** `/app/settings/integrations`

**Goal:** manage connected services and input channels.

### Initial integrations concept

* email inbox connection
* SMS provider placeholder
* calendar sync
* webhook endpoint
* import CSV

### Template skeleton

* integration cards
* setup buttons
* connection status badges

---

## 4.24 Billing page

**Route:** `/app/settings/billing`

**Goal:** manage subscription and invoices.

### Sections

* current plan
* usage
* payment method
* invoices

### Template skeleton

* plan card
* usage card
* invoice table

---

# 5. Initial design system guidance

## Layout patterns

Use only a few layout patterns early:

* centered auth layout
* marketing content layout
* app dashboard layout
* list/detail layout
* settings sidebar layout
* three-panel inbox layout

## Core UI primitives

* button
* input
* select
* textarea
* card
* table
* badge
* modal
* drawer
* tabs
* stepper
* alert
* tooltip
* dropdown menu

## Core visual concepts

* calm B2B SaaS look
* clean whitespace
* neutral palette
* strong table readability
* obvious status badges
* minimal decoration

---

# 6. Data concepts reflected in pages

Core entities implied by the sitemap:

* User
* Workspace
* Property
* Room (optional later)
* Lead
* Inquiry Source
* Message Thread
* Qualification Answer
* House Rule
* Qualification Result
* Tour Event
* Template
* Integration

---

# 7. Recommended first clickable prototype

If building the very first app shell, start with these screens:

1. Home page
2. Signup page
3. Onboarding property page
4. App dashboard
5. Leads list page
6. Lead detail page
7. Property rules page

That is enough to validate the product concept visually and architecturally.

---

# 8. Fastest v1 cut

If you want the narrowest possible initial release, the minimum usable pages are:

* `/`
* `/signup`
* `/login`
* `/onboarding/property`
* `/onboarding/house-rules`
* `/app`
* `/app/leads`
* `/app/leads/[leadId]`
* `/app/properties/[propertyId]/rules`
* `/app/templates`

This gives you:

* marketing entry
* auth
* first property config
* lead list
* lead detail workflow
* house-rule setup
* messaging templates

That is enough to build a real first version without overextending scope.
