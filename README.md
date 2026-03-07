# Roomflow

Roomflow is an ops layer for **shared-housing and room-rental leads** after they arrive from listing and lead-generation channels.

Instead of trying to replace listing sites, Roomflow sits **between inbound inquiries and the formal application process**. It captures leads, asks the missing questions, checks fit against house rules, and routes each prospect to the right next step.

## Repository status

This repository now contains an early **Next.js + Prisma bootstrap** for the first Roomflow implementation pass.

Current implementation focus:

* marketing entry
* Better Auth email/password login
* onboarding route structure
* app shell
* lead workflow screens
* initial Prisma domain model

## Local development

1. Copy `.env.example` to `.env`
2. Start the local Prisma dev database with `npx prisma dev -d --name roomflow-auth`
3. Install dependencies with `npm install`
4. Apply the schema with `npm run db:push`
5. Seed the local test account with `npm run db:seed:test-user`
6. Start the app with `npm run dev -- --hostname 127.0.0.1 --port 3001`

### Local test login

* email: `test@roomflow.local`
* password: `Roomflow123!`

The Better Auth session is configured to last 1 hour in local development.

The first implementation slice is intentionally narrow and follows the build order in [TODO.md](./TODO.md).

---

## Core idea

Listing sites are good at **finding attention**.

They are usually not good at handling the messy workflow that comes after:

* repeated "is this available?" messages
* incomplete prospect information
* no consistent qualification process
* wasted tours
* late discovery of house-rule mismatches
* fragmented communication across Facebook, SMS, email, and listing platforms

Roomflow solves that by giving landlords and small operators a **post-inquiry qualification workflow**.

---

## Product thesis

The room-rental market has a workflow problem, not just a listing problem.

For shared housing, the biggest operational pain often happens **before** the application:

* identifying serious prospects
* checking shared-house compatibility
* enforcing consistent questions
* documenting answers and decisions
* reducing wasted time on poor-fit leads

Roomflow is built around the idea that **shared-house qualification is different from standard apartment leasing**.

---

## What Roomflow is

Roomflow is:

* a **lead intake and qualification layer**
* a **CRM for room-rental inquiries**
* a **house-rules-aware screening workflow**
* a **routing engine** for decline / follow-up / schedule / apply
* a **unified inbox** for fragmented lead sources

---

## What Roomflow is not

Roomflow is not:

* a listing marketplace
* a traffic-generation platform
* a full property management suite
* a rent collection system
* a formal tenant screening or credit bureau
* an AI engine that makes final housing decisions

The product is designed to help operators run a **consistent, documented workflow**, not to act as a black-box approval system.

---

## Target users

### Primary users

* owner-occupant landlords renting out rooms
* house hackers managing shared homes
* small room-rental operators
* co-living operators with a small portfolio
* small property managers handling shared-housing inventory

### Best-fit customer profile

A landlord or operator who:

* gets leads from multiple sources
* rents rooms instead of only whole units
* has house rules that matter operationally
* wants fewer wasted showings
* wants a more consistent prescreening process

---

## The workflow

### Before Roomflow

Lead arrives from Facebook, Roomster, SpareRoom, Zillow, Craigslist, SMS, or email.

Then the landlord manually:

* replies to the lead
* asks the same questions repeatedly
* checks for budget, move-in date, and fit
* tries to schedule a tour
* forgets who answered what
* loses track of strong vs weak leads

### With Roomflow

1. Lead is captured from an inbound source
2. Roomflow extracts available info from the message
3. Missing qualification questions are sent automatically
4. Prospect answers are checked against property-specific rules
5. Lead is routed to one of several outcomes:

   * decline
   * request more info
   * schedule tour
   * send application
6. Landlord sees a clean status board and audit trail

---

## Key concepts

### 1. Lead normalization

Prospects come in from different sources with inconsistent formats.

Roomflow normalizes inbound messages into a common schema:

* name
* contact method
* source channel
* move-in date
* budget
* stay length
* work status
* notes
* qualification status

### 2. Qualification workflow

Each property or room has a standard question set.

Examples:

* target move-in date
* monthly budget
* desired lease length
* smoking status
* pet status
* overnight guest expectations
* work schedule
* parking needs
* bathroom-sharing expectations
* acknowledgment of quiet hours or cleaning rules

### 3. House-rule fit

Shared housing has constraints that often do not exist in standard leasing.

Roomflow lets operators define property-specific rules and use them as part of the workflow.

Examples:

* no smoking
* no pets
* no frequent overnight guests
* shared bathroom acceptance required
* parking is unavailable
* minimum stay preferred

### 4. Routing outcomes

Every lead should land in a clear next step.

Possible states:

* new
* awaiting response
* incomplete
* qualified
* tour scheduled
* application sent
* declined
* archived

### 5. Audit trail

Operators need a consistent record of:

* what was asked
* what was answered
* when the lead responded
* why the lead was advanced or declined

This is useful for ops discipline, customer service, and safer housing workflow documentation.

---

## Product differentiation

Roomflow differs from roommate marketplaces and listing platforms because it does **not** compete on traffic or discovery.

It differs from general landlord software because it is built specifically for the **front-end qualification workflow for room rentals and shared housing**.

### In one sentence

**Listing sites generate the lead. Roomflow qualifies and routes the lead.**

---

## Main value proposition

Roomflow helps landlords and small operators:

* respond faster
* ask consistent questions
* reduce wasted tours
* identify poor-fit inquiries earlier
* keep leads organized across channels
* enforce shared-house rules more consistently
* move good leads to the application stage faster

---

## Principles

### Narrow over broad

Start with one painful workflow instead of building an all-in-one property platform.

### Ops first

The product should focus on reducing manual work and inbox chaos.

### Shared-house aware

This product exists because room rentals have different needs from whole-unit leasing.

### Transparent workflow

The product should document process and outcomes clearly.

### Human-in-the-loop

The operator stays in control. Roomflow assists the workflow; it does not replace judgment.

---

## MVP scope

### Core MVP

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
