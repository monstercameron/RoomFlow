## Workflow 4 — Define Qualification Questions

This is the workflow where Roomflow learns **what you need to ask every lead** before deciding whether they are worth pursuing.

Workflow 3 defined the **rules**.
Workflow 4 defines the **questions that collect the data needed to evaluate those rules**.

This workflow powers:

* lead completeness
* AI missing-info detection
* automated follow-up
* fit evaluation
* review queue quality
* better messaging

If Workflow 3 is **policy**, Workflow 4 is **intake**.

---

# Purpose

The goal of this workflow is to let the user define the **standard intake questions** Roomflow should gather from each lead.

This workflow should:

* create a reusable qualification question set
* distinguish required vs optional questions
* tie questions to property realities
* keep the list short and practical
* prepare the app for real lead handling

---

# Primary goals

1. define the minimum information needed from each lead
2. reduce repetitive manual back-and-forth
3. ensure Roomflow can detect missing data
4. connect questions to house rules and routing
5. route user into channel setup or first lead import

---

# Secondary goals

* make AI drafts better
* improve inbox prioritization
* reduce wasted tours
* create a consistent intake process
* help the user clarify what they actually care about

---

# Position in onboarding

Suggested sequence:

1. Sign up / workspace
2. Create first property
3. Define house rules
4. **Define qualification questions**
5. Connect channels
6. Add/import first lead

This should be required in onboarding, but lightweight.

---

# User mental model

The user should think:

```text
What do I need to know from someone before I decide whether they fit this house?
```

Not:

```text
I’m designing a giant application form.
```

This is a **pre-screening question set**, not a full tenant application.

---

# What a qualification question is

A qualification question is a structured question used to collect information that matters for:

* fit
* readiness
* logistics
* communication
* next-step routing

Examples:

* When are you looking to move in?
* What is your budget?
* How long are you looking to stay?
* Do you smoke?
* Do you have pets?
* Are you okay sharing a bathroom?
* Do you need parking?
* Do you expect regular overnight guests?

---

# What this workflow is NOT

It is not:

* a full rental application
* a background check form
* a credit authorization form
* a legal screening packet
* a giant demographic form

Do not ask for:

* SSN
* driver’s license
* full employment history
* detailed income verification
* banking info
* protected-class information
* criminal-history self-disclosure unless counsel/provider model explicitly supports it later

This workflow is about **lightweight qualification**, not regulated screening.

---

# Core question categories for v1

Use a small, strong set.

## 1. Move-in timing

Examples:

* When are you looking to move in?
* What is your target move-in date?

## 2. Budget

Examples:

* What monthly rent range are you comfortable with?
* What is your max monthly budget?

## 3. Stay length

Examples:

* How long are you looking to stay?
* Are you looking for short-term or long-term housing?

## 4. Smoking

Examples:

* Do you smoke?
* Would you need smoking accommodation?

## 5. Pets

Examples:

* Do you have any pets?
* Would you be bringing any animals?

## 6. Bathroom sharing

Examples:

* Are you comfortable sharing a bathroom?
* Do you require a private bathroom?

## 7. Parking

Examples:

* Do you need parking?
* What kind of parking do you need?

## 8. Guests

Examples:

* Do you expect regular overnight guests?
* How often would you have visitors staying overnight?

## 9. Occupation / schedule

Examples:

* What kind of work schedule do you keep?
* Do you work nights, days, or remotely?

## 10. Additional context

Examples:

* Anything else you’d like us to know?
* Do you have any specific living requirements?

---

# Required vs optional questions

This distinction is essential.

## Required

If unanswered, the lead remains incomplete.

Examples:

* move-in timing
* budget
* stay length
* bathroom sharing if relevant
* smoking if relevant
* pets if relevant

## Optional

Helpful, but not blocking.

Examples:

* occupation
* parking
* additional notes
* guest frequency if not critical

---

# Why this matters

If too many questions are required:

* response rates drop
* friction rises
* leads ghost

If too few are required:

* qualification becomes weak
* user still has to manually chase details

So v1 should encourage:

* **4 to 7 required questions**
* **2 to 4 optional questions**

---

# Workflow entry point

Main route:

```text
/onboarding/questions
```

Also reachable later from:

```text
/app/properties/[propertyId]/questions
```

---

# Page purpose copy

## Title

```text
Set your qualification questions
```

## Supporting copy

```text
These are the questions Roomflow will use to collect the information you need from each lead.
```

Optional helper:

```text
Keep this short and practical. You can always edit it later.
```

---

# Recommended UI structure

This page should be guided and semi-structured.

## Section 1 — Suggested questions

Based on:

* property type
* house rules
* shared-housing context

## Section 2 — Required questions

Questions the user wants asked before a lead is considered complete.

## Section 3 — Optional questions

Useful but non-blocking questions.

## Section 4 — Preview

Show how this question set will work in practice.

## Bottom actions

* Back
* Save and continue

---

# Suggested-question behavior

Roomflow should preload smart defaults based on prior steps.

## Example: owner-occupied shared home with shared bathroom

Suggested required:

* move-in date
* budget
* intended stay
* smoking
* pets
* bathroom-sharing comfort

Suggested optional:

* parking
* work schedule
* overnight guests

## Example: small co-living property

Suggested required:

* move-in date
* budget
* stay length
* smoking
* pets

Suggested optional:

* parking
* guest frequency
* notes

These suggestions should be editable.

---

# Dos for suggestions

## DO

* preload useful starter questions
* explain why they were suggested
* let user toggle required/optional/off
* tie suggestions to rules

## DON’T

* force every suggested question
* make suggestions feel legal or mandatory
* generate 15+ questions in onboarding

---

# Question model

Each question should support:

```text
id
property_id
label
question_type
category
required
active
display_order
options_json nullable
help_text nullable
created_at
updated_at
```

---

# Supported question types for v1

Keep it small.

## 1. Short text

Examples:

* work schedule
* additional notes

## 2. Select / single choice

Examples:

* smoking
* pets
* parking
* bathroom preference

## 3. Yes / no

Examples:

* Do you smoke?
* Do you need parking?

## 4. Number

Examples:

* monthly budget

## 5. Date

Examples:

* target move-in date

For v1, do not add:

* multi-select
* file upload
* long forms
* repeating sections
* nested logic

---

# Best defaults by category

## Move-in timing

Type:

```text
date or short text
```

Recommended:

```text
required
```

## Budget

Type:

```text
number or short text
```

Recommended:

```text
required
```

## Stay length

Type:

```text
select
```

Recommended:

```text
required
```

## Smoking

Type:

```text
yes/no or select
```

Recommended:

```text
required if smoking rule exists
```

## Pets

Type:

```text
yes/no or select
```

Recommended:

```text
required if pet rule exists
```

## Bathroom sharing

Type:

```text
yes/no or select
```

Recommended:

```text
required if shared bathroom context exists
```

## Parking

Type:

```text
yes/no or select
```

Recommended:

```text
optional unless parking is highly constrained
```

---

# UI interaction patterns

## Pattern 1 — Suggested question cards

Each suggested question appears as a card.

Card contains:

* question label
* type
* why it matters
* toggle:

  * required
  * optional
  * off

This is the best onboarding pattern.

---

## Pattern 2 — Add custom question

User clicks:

```text
Add question
```

A small editor appears.

Fields:

* question label
* type
* required yes/no
* answer options if select
* help text optional

---

## Pattern 3 — Reorder questions

Questions should be reorderable.

Best behavior:

* simple drag handle or move up/down buttons
* order affects how questions are shown and asked later

---

# Example card UX

## Question card: Budget

Label:

```text
Monthly budget
```

Description:

```text
Useful for filtering obvious price mismatches early.
```

Controls:

* Required
* Optional
* Off

Advanced edit:

* question wording
* answer type
* placeholder/help text

---

# Required/optional/off UX

This must be extremely obvious.

Best wording:

## Required

```text
Must be answered before a lead is complete
```

## Optional

```text
Nice to have, but not required
```

## Off

```text
Don’t ask this by default
```

This is clearer than just a checkbox.

---

# Question wording customization

Users should be able to edit the wording.

Example default:

```text
What is your target move-in date?
```

User-edited version:

```text
When would you ideally want to move in?
```

This is good because some users prefer softer language.

---

# Custom question dos and don’ts

## DO

* allow custom question label
* allow simple answer type selection
* allow required/optional choice
* allow deleting later

## DON’T

* allow dangerous or confusing complexity
* support giant branching logic in v1
* encourage legal or protected-category questions

---

# Built-in safety nudges

This workflow should contain lightweight safety guidance.

Example helper text:

```text
Keep your questions focused on logistics, fit, and house expectations.
```

Optional safety note:

```text
Avoid asking for sensitive or unrelated personal information at this stage.
```

Do not make this page sound like a legal training course, but a gentle guardrail is smart.

---

# Preview panel

A preview panel is very useful.

## Preview should show:

* the order of questions
* which are required
* which are optional
* what a lead intake interaction might look like

Example:

```text
Your lead intake flow:
1. Target move-in date (required)
2. Monthly budget (required)
3. Intended stay length (required)
4. Do you smoke? (required)
5. Do you have pets? (required)
6. Do you need parking? (optional)
7. Anything else we should know? (optional)
```

This gives the user confidence.

---

# Navigation behavior

## Primary action

```text
Save and continue
```

Next route:

```text
/onboarding/channels
```

or, if you want to go directly to first-value faster:

```text
/onboarding/first-lead
```

Given your product shape, I’d still do channels next.

## Secondary action

```text
Back
```

Route:

```text
/onboarding/house-rules
```

---

# Save behavior

On save:

1. validate active questions
2. ensure there is at least one required question
3. ensure ordering exists
4. persist question set
5. mark default question set active for property
6. create activity event
7. update future AI and qualification context
8. route to next step

---

# Validation rules

## Minimum requirements

Require at least:

* 1 required question
* 1 total active question

Recommended warning if too many required:
If required question count > 8, show warning:

```text
That may feel like a lot for an initial inquiry. Consider making some questions optional.
```

## Invalid custom question

Errors if:

* label missing
* type missing
* select question has no options

---

# Good defaults for v1

A strong default question set:

### Required

* target move-in date
* monthly budget
* intended stay length
* smoking
* pets
* bathroom-sharing comfort (if relevant)

### Optional

* parking need
* overnight guest expectations
* anything else we should know

This is enough to make the system useful.

---

# Questions to avoid in v1 onboarding

Do not encourage:

* full legal name
* SSN
* date of birth
* race/ethnicity
* religion
* nationality unless legally required in some later context
* disability-related questions
* criminal-history self-reporting
* relationship status
* children/family status
* political affiliation
* income proof uploads

Those belong in later regulated or provider-mediated flows, if at all.

---

# Accessibility requirements

Must support:

* keyboard navigation
* reorder controls accessible without drag only
* clearly labeled required/optional state
* radio groups/selects accessible
* errors linked to fields
* screen-reader-friendly preview

---

# Mobile behavior

This page should work well on mobile.

Recommended:

* one question card per row
* expandable editors
* move up/down controls instead of drag-only
* preview panel below main content
* sticky bottom CTA optional

Avoid:

* dense builder UI
* complicated side panels
* drag-only interactions

---

# AI use in this workflow

AI can help here, but lightly.

## Good AI uses

* suggest questions from house rules
* improve wording clarity
* suggest required vs optional classification
* later convert freeform rules into intake questions

## Bad AI uses

* generating an overly long questionnaire
* suggesting sensitive/regulated questions
* making the workflow feel opaque or random

This should remain a largely deterministic setup flow.

---

# Internal logic relationship to house rules

This workflow should be rule-aware.

Examples:

## If rule = no smoking

Strongly suggest question:

```text
Do you smoke?
```

## If rule = no pets

Suggest:

```text
Do you have any pets?
```

## If rule = bathroom sharing required

Suggest:

```text
Are you comfortable sharing a bathroom?
```

## If rule = minimum stay 6 months+

Suggest:

```text
How long are you planning to stay?
```

This keeps the app internally coherent.

---

# Analytics events

Track:

* qualification_questions_started
* qualification_questions_completed
* question_added
* question_removed
* question_marked_required
* question_marked_optional
* question_reordered
* onboarding_questions_abandoned

Useful dimensions:

* property type
* number of required questions
* number of total questions

---

# Success criteria

This workflow is successful if:

* user creates a solid intake set in under 3 minutes
* required questions are practical and not excessive
* question set is coherent with rules
* user feels ready to process real leads
* user continues into channels or first lead setup

---

# Product risks

## Risk 1: too many questions

Fix:

* good defaults
* warning if required count too high

## Risk 2: weak questions

Fix:

* strong suggestions based on rules

## Risk 3: regulated/sensitive questions creep in

Fix:

* guardrails
* warning copy
* limited builder complexity

## Risk 4: onboarding fatigue

Fix:

* keep custom editing light
* show preview
* make suggestions strong enough that editing is minimal

---

# Suggested copy examples

## Page header

```text
Set your qualification questions
```

## Helper copy

```text
These questions help Roomflow collect the information you need before deciding on next steps.
```

## Safety helper

```text
Keep questions focused on fit, logistics, and shared-living expectations.
```

## CTA

```text
Save and continue
```

---

# Completion criteria

Workflow 4 is complete when:

* active question set exists
* required/optional states exist
* display order exists
* question set is attached to property
* system can now detect missing information on leads
* user is routed to the next onboarding step

---

# Final summary

Workflow 4 should feel like:

**“Tell Roomflow what you need to know from each lead before they are really worth your time.”**

It should be:

* practical
* short
* rules-aware
* easy to edit
* strong enough to power follow-up and fit logic

It should not feel like:

* a legal application packet
* a giant form builder
* a tenant-screening questionnaire

The ideal user reaction is:

**“Okay, now Roomflow knows what information I need from people before I move forward.”**

Next would be Workflow 5:

## Connect Communication Channels
