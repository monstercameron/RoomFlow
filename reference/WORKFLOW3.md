## Workflow 3 — Define House Rules

This is where Roomflow stops being a generic inbox and starts becoming **shared-housing-specific software**.

Workflow 2 told the system **what property exists**.
Workflow 3 tells the system **how that property should be operated**.

These rules drive:

* qualification
* AI explanations
* mismatch/caution logic
* message drafting
* review queue behavior
* future automation

So this workflow is extremely important.

---

# Purpose

The goal of this workflow is to let the user define the **operational rules and living constraints** for a property.

This workflow should:

* capture the rules that matter for shared housing
* distinguish between hard blockers and softer preferences
* keep the process simple and readable
* prepare the system for fit evaluation
* avoid turning the user into a compliance lawyer

---

# Primary goals

1. define the house constraints that affect lead fit
2. create a ruleset the system can evaluate against
3. separate strict rules from softer preferences
4. make the property feel personalized
5. route the user to qualification question setup

---

# Secondary goals

* prepare better AI explanations
* reduce wasted tours
* reduce repeated clarification messages
* help the user think through their own house policies

---

# Position in onboarding

Suggested sequence:

1. Sign up / workspace
2. Create first property
3. **Define house rules**
4. Define qualification questions
5. Connect channels
6. Add/import first lead

This is a required onboarding step.

---

# User mental model

The user should think:

```text
I’m telling Roomflow what kind of person fits this house and what expectations matter.
```

Not:

```text
I’m filling out a legal policy engine.
```

This workflow should feel practical and lifestyle-oriented, not technical.

---

# What counts as a house rule

A house rule is any property-specific expectation, limit, or condition that may affect whether a lead is:

* a likely fit
* a caution case
* a mismatch

Examples:

* no smoking
* no pets
* no frequent overnight guests
* must be okay sharing a bathroom
* parking is limited
* minimum preferred stay
* quiet hours matter
* owner-occupied house expectations
* no parties
* must keep common areas clean

---

# Rule categories for v1

Use a small, practical set of categories.

## Core categories

### 1. Smoking

Options:

* not allowed
* allowed outside only
* allowed
* case by case

### 2. Pets

Options:

* not allowed
* allowed
* case by case

### 3. Guests

Options:

* no overnight guests
* limited overnight guests
* reasonable guests allowed
* case by case

### 4. Bathroom sharing

Options:

* must be comfortable sharing bathroom
* private bathroom available
* varies by room
* not applicable

### 5. Parking

Options:

* no parking
* street only
* limited on-site parking
* guaranteed parking
* ask first

### 6. Minimum stay

Options:

* no preference
* 1 month+
* 3 months+
* 6 months+
* 12 months+

### 7. Quiet hours / noise

Options:

* quiet household
* standard quiet hours
* flexible
* not specified

### 8. Furnishing / room setup

Options:

* furnished
* unfurnished
* partially furnished
* varies

### 9. House lifestyle expectations

Examples:

* clean common areas
* no parties
* respectful shared-living behavior
* owner-occupied norms
* professional / quiet environment

---

# Rule severity model

This is critical.

Every rule should be classifiable as one of:

## 1. Blocking

If violated, this is a likely mismatch.

Examples:

* no smoking
* no pets
* lead refuses shared bathroom where required

## 2. Warning

If triggered, this should create caution / review.

Examples:

* minimum stay preferred but not mandatory
* parking request when parking is limited
* guest habits unclear

## 3. Informational

Does not directly affect fit but should be visible.

Examples:

* room is furnished
* house is generally quiet
* owner-occupied home

---

# Why severity matters

If you do not distinguish between hard blockers and softer preferences, the system becomes noisy and unusable.

You want:

* a few real blockers
* some caution flags
* a few informational notes

Not:

* everything acting like a red alert

---

# Workflow entry point

Main route:

```text
/onboarding/house-rules
```

Should also be reachable later from:

```text
/app/properties/[propertyId]/rules
```

---

# Page purpose copy

## Page title

```text
Set your house rules
```

## Supporting copy

```text
These rules help Roomflow identify strong-fit leads and flag issues early.
```

Optional helper copy:

```text
You can change these later.
```

---

# Recommended UI structure

This page should not be a giant blank form.

Best structure:

## Section 1 — Suggested rules

Show recommended rules based on property type from Workflow 2.

Example:

* no smoking
* shared bathroom required
* quiet household
* limited overnight guests

User can:

* accept
* edit
* remove

## Section 2 — Core house rules

Card-based or row-based structured inputs for the main categories.

## Section 3 — Additional expectations

Freeform or semi-structured custom rules.

## Section 4 — Severity review

Show which rules are:

* blocking
* warning
* informational

## Bottom actions

* Back
* Save and continue

---

# Rule setup patterns

You have two good patterns.

## Pattern A — Guided cards

Each rule category is shown as a card with:

* title
* short description
* options
* severity

This is the best onboarding UX.

## Pattern B — Table/list editor

Better for later app settings, not best for onboarding.

For onboarding, use **guided cards**.

---

# Suggested guided card example

## Smoking card

Title:

```text
Smoking
```

Description:

```text
How should Roomflow treat smoking-related fit?
```

Options:

* Not allowed
* Allowed outside only
* Allowed
* Case by case

Severity selector:

* Block if violated
* Warn me
* Informational only

Best default:

* Not allowed
* Block if violated

---

# Default recommendation behavior

Based on property type and shared-living setup, Roomflow should preload likely rules.

## Example: owner-occupied shared home

Suggested defaults:

* smoking = not allowed
* guests = limited overnight guests
* bathroom sharing = must be okay sharing
* quiet household = warning or informational
* minimum stay = 3 months+ warning

## Example: small co-living property

Suggested defaults:

* smoking = not allowed
* guests = case by case
* bathroom sharing = depends on room
* parking = ask first
* minimum stay = 1 month+

The user should never feel trapped by recommendations.

They must be able to:

* accept
* modify
* remove

---

# Dos for suggested rules

## DO

* use suggestions to reduce blank-page stress
* explain that suggestions are editable
* tie suggestions to property type
* keep defaults conservative but not rigid

## DON’T

* auto-save suggested rules without user confirmation
* present suggestions as legal advice
* overfit to one landlord style

---

# The “custom rule” section

This is important because not every house expectation fits a structured category.

Examples:

* must be comfortable with owner living on-site
* no heavy cooking late at night
* no shared common-area storage
* keep kitchen clean after use
* no loud gatherings
* respectful of work-from-home environment

## UX behavior

User clicks:

```text
Add custom rule
```

Fields:

* rule title
* short explanation
* severity
* optional matching keywords or notes later

For v1, keep custom rules simple:

* title
* description
* severity

No need for advanced logic builder yet.

---

# Rule severity UX

This needs to be very understandable.

Best wording:

## Blocking

```text
Treat this as a likely mismatch
```

## Warning

```text
Flag this for my review
```

## Informational

```text
Show this as a note only
```

This is clearer than raw labels alone.

---

# Good defaults for severity

To keep users from creating bad workflows, prefill likely severities.

Examples:

### Smoking = not allowed

Default severity:

```text
blocking
```

### Minimum stay = 6 months+

Default severity:

```text
warning
```

### Quiet household

Default severity:

```text
informational or warning
```

### Parking limited

Default severity:

```text
warning
```

---

# Real-time preview panel

This would be very useful.

A right-side or bottom summary panel can say:

```text
Your current ruleset:
3 blocking rules
2 warning rules
2 informational notes
```

And maybe list them:

```text
Blocking
- No smoking
- No pets
- Shared bathroom acceptance required

Warnings
- Minimum stay 6 months+
- Parking is limited
```

This helps the user understand what they’re building.

---

# Navigation behavior

## Primary action

```text
Save and continue
```

Route:

```text
/onboarding/questions
```

## Secondary action

```text
Back
```

Route:

```text
/onboarding/property
```

---

# Save behavior

When user clicks save:

1. validate rules
2. persist structured rules
3. persist custom rules
4. attach severity metadata
5. mark ruleset active for property
6. create audit/activity event
7. generate suggested qualification questions for next step

---

# Backend model expectations

Each rule should roughly support:

```text
id
property_id
category
label
description
selected_value
severity
active
created_at
updated_at
created_by
```

For custom rules:

```text
category = custom
label = user-entered
description = user-entered
```

---

# Rule normalization examples

## Smoking example

Input:

```text
Not allowed
```

Stored value:

```text
category = smoking
selected_value = disallowed
severity = blocking
```

## Guests example

Input:

```text
Limited overnight guests
```

Stored value:

```text
category = guests
selected_value = limited_overnight
severity = warning
```

---

# Validation rules

## Required?

This is interesting.

You should **not** require every category.

Instead:

* require at least **one active rule**
* encourage the main categories
* allow partial setup

If user leaves many empty, show nudge:

```text
Adding a few key rules helps Roomflow flag poor-fit leads earlier.
```

## Required structured fields per rule

If a rule is enabled:

* value required
* severity required

---

# Error scenarios

## No rules selected

Allow save, but warn.

Example:

```text
You haven’t added any house rules yet. Roomflow will have less context when qualifying leads.
```

Offer:

* Go back and add rules
* Continue anyway

For onboarding, I’d prefer at least one rule or one custom expectation before continuing.

## Invalid custom rule

Example:

* empty title
* severity missing

Error:

```text
Please complete your custom rule before saving.
```

---

# UI interactions in detail

## Enabling a rule

User clicks card or toggle:

```text
Enable smoking rule
```

Rule expands.

## Selecting a value

Radio group or segmented control.

## Selecting severity

Secondary segmented control.

## Removing/disabling a rule

User clicks:

```text
Remove
```

or toggles off.

Disabled rules should not affect fit logic.

---

# Best UI component choices

## For category value

Use:

* radio cards
* segmented control
* compact select if many options

## For severity

Use:

* pills / segmented toggle
* with helper text beneath

## For custom rules

Use:

* expandable mini-form
* inline list editor

---

# Accessibility requirements

Must support:

* keyboard-accessible rule toggles
* radio groups with labels
* clear grouping per rule card
* summary panel readable by screen readers
* error messages tied to invalid controls

---

# Mobile behavior

This page must work well on mobile.

Recommended:

* stacked cards
* each rule as collapsible section
* summary panel moves below form
* sticky bottom CTA optional

Avoid:

* dense horizontal tables
* too many side-by-side controls

---

# AI use in this workflow

AI should help lightly, not dominate.

Good AI uses:

* suggest initial rules based on property type
* help word custom rules more clearly
* later convert freeform expectations into structured categories

Bad AI uses:

* silently invent house rules
* overcomplicate onboarding
* present legal/compliance advice as certainty

---

# Good helper copy examples

## General helper

```text
Think about the expectations that matter most for day-to-day living in this house.
```

## Severity helper

```text
Use “blocking” for hard no’s, “warning” for soft preferences, and “informational” for context only.
```

## Custom rule helper

```text
Add anything specific to your house that Roomflow should remember.
```

---

# Dos for this workflow

## DO

* make rule setup feel practical
* use suggested defaults
* distinguish blocker vs warning clearly
* let users customize freely
* provide real-time summary of ruleset
* keep language human and household-oriented
* let users edit later without penalty

## DO

* help users avoid making everything a blocker
* make custom rules easy
* explain why rules matter for qualification

---

# Don’ts for this workflow

## DON’T

* make users define legal policy text
* force every category
* bury severity logic
* turn onboarding into a rules-engine builder
* use jargon like:

  * decision matrix
  * inference policy
  * household classifier
  * mismatch ontology

## DON’T

* auto-decline based on rules during onboarding
* require exact wording perfection
* make users feel like they’re writing a rental contract

---

# Analytics events

Track:

* house_rules_started
* house_rules_completed
* rule_added
* rule_removed
* custom_rule_added
* blocking_rule_count
* warning_rule_count
* informational_rule_count
* onboarding_house_rules_abandoned

These help you understand where setup gets too complex.

---

# Success criteria

This workflow is successful if:

* user creates a meaningful ruleset in under 3 minutes
* user understands the difference between hard blockers and softer preferences
* ruleset is good enough to power lead fit logic
* user proceeds to qualification question setup

---

# Product risks

## Risk 1: too many rule options

Fix:

* start with a small category set
* hide advanced cases

## Risk 2: users mark everything blocking

Fix:

* use good defaults
* give helper text
* show summary counts

## Risk 3: rules feel too abstract

Fix:

* tie rules to real household situations
* show examples

## Risk 4: user thinks this is legal advice

Fix:

* keep framing operational, not legal
* avoid compliance-heavy wording here

---

# Completion criteria

Workflow 3 is complete when:

* property has active rules
* rules have values and severities
* custom rules saved if any
* ruleset summary exists
* system is ready to suggest or build qualification questions
* user is routed to Workflow 4

---

# Final summary

Workflow 3 should feel like:

**“Tell Roomflow what kind of living situation this is, what is a hard no, and what is just a preference.”**

It should be:

* specific
* calm
* shared-housing-aware
* quick to finish
* powerful enough to shape fit evaluation

It should not feel like:

* writing a lease
* configuring enterprise rule logic
* legal policy drafting

The ideal user reaction is:

**“Okay — now Roomflow understands the kind of person this house is right for.”**

Next would be Workflow 4:

## Define Qualification Questions
