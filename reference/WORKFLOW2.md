## Workflow 2 — Create First Property

This is the first real “product value” workflow after signup.

If Workflow 1 is about **identity + workspace creation**, Workflow 2 is about **anchoring the product around a real operating context**.

Without a property, Roomflow is abstract.
With a property, the rest of the app becomes concrete:

* house rules
* qualification questions
* lead routing
* messaging context
* scheduling
* AI suggestions

So this workflow must feel:

* fast
* obvious
* low-friction
* operationally meaningful

---

# Purpose

The goal of this workflow is to let the user create the **first property/shared house context** that all future lead handling will attach to.

This workflow should:

* establish the first property record
* capture only essential property details
* avoid overwhelming the user
* prepare the system for rules and qualification
* move the user into the next onboarding flow

---

# Primary goals

1. create the first property successfully
2. capture enough detail to personalize the workflow
3. avoid overwhelming the user with too many fields
4. set up the basis for rules/questions
5. keep momentum high after signup

---

# Secondary goals

* infer defaults for house rules/questions
* set up channel compatibility later
* create the first “aha” moment:
  **“this system is now configured for my actual rental situation”**

---

# Entry point

Main entry:

```text
/onboarding/property
```

This page should normally be reached after:

* signup
* workspace creation
* invite acceptance if the invited user is the first setup owner/admin

It may also be reachable later from:

* app dashboard with no properties
* properties page -> “Create property”
* onboarding resume flow

---

# Position in onboarding

Suggested sequence:

1. Sign up / workspace
2. **Create first property**
3. Define house rules
4. Define qualification questions
5. Connect channels
6. Add or import first lead

This workflow should feel like the first meaningful setup action.

---

# What a “property” means in v1

In v1, a property should be modeled at the **property/shared-house level**, not at per-room inventory depth.

That means the user is creating:

* a house
* a shared rental location
* a room-rental address/context

Not:

* a full unit inventory system
* lease objects
* room-level occupancy map

This is important because over-modeling here will create unnecessary complexity.

---

# User mental model

The user should think:

```text
I’m telling Roomflow what house or shared rental situation I’m managing.
```

Not:

```text
I’m filling out enterprise property management software.
```

---

# Core property creation UX

The page should feel like a short guided setup form, not an admin panel.

## Page title

```text
Set up your first property
```

## Supporting text

```text
This helps Roomflow qualify leads using the right rules, questions, and messaging.
```

---

# Core form fields

These fields should be in v1.

## Required fields

### 1. Property name

Examples:

* Downtown Shared House
* Broward Room Rental
* Upstairs Guest Room House
* 18th Street Shared Home

This is the internal label used throughout the app.

### 2. Property type

Suggested options:

* Owner-occupied shared home
* Non-owner-occupied shared home
* Small co-living property
* Other shared housing

This matters because it can shape recommended rules/questions.

### 3. General location

You have two good options:

* full address
* city/area only

For low-friction onboarding, allow:

* full street address optional
* area/city required

Example:

* Lauderhill, FL
* Broward County, FL
* Bacolod City
* North Miami

### 4. Number of rentable rooms

Simple numeric input.

### 5. Shared bathroom count

Simple numeric input or select:

* 0
* 1
* 2+
* unknown

---

## Optional but very useful fields

### 6. Parking availability

Options:

* none
* street only
* driveway
* garage
* limited / ask first

### 7. Smoking allowed

Options:

* no
* yes
* outside only

### 8. Pets allowed

Options:

* no
* yes
* case by case

### 9. Minimum preferred stay

Options:

* no preference
* 1 month+
* 3 months+
* 6 months+
* 12 months+

### 10. Furnished

Options:

* yes
* no
* partially

---

# Fields to avoid in this workflow

Do not ask for these yet unless absolutely necessary:

* lease template details
* rent amount if not needed yet
* utility breakdown
* screening package
* broker/MLS info
* legal owner details
* tax IDs
* company registration
* room-by-room occupancy chart
* property photos
* full listing syndication settings
* payment processor setup

This workflow must not feel like paperwork.

---

# Layout and UI structure

## Recommended layout

Single centered content panel or two-column onboarding layout.

### Top section

```text
Step 1 of 5
Set up your first property
```

### Middle section

Property form grouped into:

* Basic details
* Shared-living details
* Preferences

### Bottom section

Buttons:

* Back
* Save and continue

---

# Navigation behavior

## Primary action

```text
Save and continue
```

Routes to:

```text
/onboarding/house-rules
```

## Secondary action

```text
Back
```

Routes to:

* workspace setup if still in initial onboarding
* previous onboarding step

## Tertiary action

Optional:

```text
Skip for now
```

But this should be used carefully.

My recommendation:

* do **not** show skip on first-run onboarding
* property setup should be required for meaningful value

---

# Default value behavior

The workflow should help the user move fast by setting smart defaults.

## Default property name

If the user does not type anything, prefill:

```text
My First Property
```

or based on location:

```text
Lauderhill Shared House
```

## Default property type

If no strong signal:

```text
Owner-occupied shared home
```

## Default preferences

* smoking allowed: no
* pets allowed: no or case by case
* minimum stay: no preference

These defaults should be editable immediately.

---

# Smart recommendation behavior

This workflow can quietly power later personalization.

Based on answers, Roomflow should prepare suggested:

* house rules
* intake questions
* message language
* follow-up tone
* AI prompts

Examples:

## If owner-occupied + shared bathroom

Suggest future rules like:

* quiet hours
* shared bathroom expectations
* guest policy
* cleaning norms

## If non-owner-occupied shared home

Suggest:

* general property conduct
* parking rules
* room cleanliness
* common-area respect

---

# Field-level UX interactions

## Property name input

Behavior:

* auto-focus on first load
* real-time validation
* max length around 80–100 chars

Error example:

```text
Please enter a property name
```

---

## Property type selector

Best as cards or segmented select, not plain dropdown.

Options should be visually clear.

User interaction:

* click one card
* card highlights
* supporting description visible

---

## Location input

Keep it simple.

For v1:

* single text input is fine

Placeholder:

```text
City, neighborhood, or address
```

Do not require geocoding in the first version.

---

## Numeric fields

Use simple number inputs or select menus.

For count fields:

* show steppers or dropdown
* disallow negative numbers
* allow empty until submit if optional

---

## Optional fields

These should look optional and low-pressure.

Maybe grouped under:

```text
Optional preferences
```

This reduces friction.

---

# Validation rules

## Required at submit

* property name
* property type
* location
* rentable rooms count

## Optional

* shared bathroom count
* parking
* smoking
* pets
* minimum stay
* furnished

## Validation examples

### Name missing

```text
Please add a property name
```

### Rooms invalid

```text
Please enter at least 1 rentable room
```

### Location blank

```text
Please add a city, area, or address
```

---

# Save behavior

When user clicks:

```text
Save and continue
```

System should:

1. validate inputs
2. create property record
3. attach property to workspace
4. create default property settings
5. log activity event
6. prepare suggested rules/question templates
7. route to next onboarding step

---

# Backend object creation

## Property

Fields:

```text
id
workspace_id
name
property_type
location_label
address_line_1 nullable
city nullable
state nullable
country nullable
rentable_rooms_count
shared_bathroom_count nullable
parking_type nullable
smoking_policy nullable
pets_policy nullable
minimum_stay_preference nullable
furnished_state nullable
created_at
updated_at
```

## Property settings

Fields:

```text
property_id
qualification_enabled = true
default_channel_preference = email
default_followup_policy = conservative
```

## Suggested onboarding artifacts

System may create draft, unpublished:

* suggested house rules set
* suggested question set

These should not be considered active until user reviews them in later steps.

---

# Audit logging

Create event:

```text
property_created
```

Metadata:

* property_id
* created_by
* initial_type
* onboarding_source = initial_setup

This matters for traceability.

---

# Dos for this workflow

## DO

* keep the form short
* ask only what powers later workflow value
* use plain language
* provide sensible defaults
* make property type visually obvious
* allow partial operational detail
* route immediately to rules setup
* preserve momentum

## DO

* let users rename later
* let users change preferences later
* keep technical language out of onboarding
* explain why the property matters

Good helper copy:

```text
Roomflow uses this to suggest house rules, intake questions, and messaging.
```

---

# Don’ts for this workflow

## DON’T

* overload with PM-style fields
* ask for financial/accounting setup
* require exact address if not needed
* require photos
* require room-by-room setup
* require integrations before property exists
* ask legal/compliance-heavy questions at this stage
* turn this into a listing creation wizard

## DON’T

* block the user on optional details
* force property perfection before progress
* use vague labels like “unit schema” or “housing asset”

---

# UI states

## Initial state

Form loads empty or lightly prefilled.

## In-progress state

As user types/selects:

* inline validation
* autosave optional, but not necessary for v1

## Saving state

Button changes to:

```text
Saving property...
```

Disable duplicate submit.

## Success state

Immediate redirect to next onboarding step.

## Error state

Inline general error banner:

```text
We couldn’t save your property. Please try again.
```

And preserve form values.

---

# Accessibility requirements

Must support:

* keyboard navigation
* proper labels for all inputs
* grouped fieldsets for related settings
* error messages announced correctly
* large click targets for property type cards

---

# Mobile behavior

This workflow must be mobile-friendly.

## Requirements

* stacked layout
* large form controls
* avoid tiny numeric steppers
* sticky bottom CTA optional
* no multi-column complexity on small screens

---

# Empty state behavior later in app

If a signed-in user somehow has no property, the dashboard should push them back into this workflow.

Message:

```text
Create your first property to start qualifying leads.
```

CTA:

```text
Create property
```

---

# Invite/user role behavior

## Personal user

Creates first property directly.

## Org owner/admin

Creates first property during onboarding.

## Invited manager/viewer

Usually should not be forced into this flow unless they have create-property permission and workspace has none.

Permission-sensitive behavior matters here.

---

# AI assistance in this workflow

AI should be light-touch here.

Possible uses:

* suggest property name from location
* later generate recommended rules/questions
* infer recommended defaults from selected type

AI should **not** interrupt the form itself heavily.

This workflow should remain deterministic and calm.

---

# Analytics events

Track:

* property_setup_started
* property_setup_completed
* property_type_selected
* onboarding_property_abandoned
* time_to_property_creation

Useful dimensions:

* signup method
* plan type
* traffic source
* selected property type

---

# Success criteria

This workflow is successful if:

* user creates first property in under 2 minutes
* user understands why property setup matters
* user moves forward into house-rules setup
* drop-off is low
* property data is good enough to power next steps

---

# Product risks in this workflow

## Risk 1: too many fields

Fix:

* reduce scope
* push details later

## Risk 2: too abstract

Fix:

* explain why the property matters
* use concrete examples

## Risk 3: too much real-estate jargon

Fix:

* use room-rental operator language

## Risk 4: users don’t know exact answers

Fix:

* make many fields optional
* allow editing later

---

# Suggested copy examples

## Page header

```text
Set up your first property
```

## Supporting copy

```text
This gives Roomflow the context it needs to qualify leads and suggest the right next steps.
```

## Optional section label

```text
Optional preferences
```

## CTA

```text
Save and continue
```

---

# Completion criteria

Workflow 2 is complete when:

* property record exists
* property belongs to workspace
* initial settings exist
* suggested downstream setup artifacts are ready
* user is routed to house rules workflow

---

# Final summary

Workflow 2 should feel like:

**“Tell Roomflow what kind of shared-rental property you manage so it can help you operate it.”**

It should be:

* simple
* quick
* concrete
* forgiving
* operationally meaningful

It should not feel like:

* enterprise property software
* tax/accounting software
* a long-form listing wizard

The best version of this flow gets the user from zero to:
**“Okay, now the system understands my house.”**

I can do Workflow 3 next in the same depth: **Define House Rules**.
