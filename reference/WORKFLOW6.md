# Roomflow — Property Management Workflow Specification

This document defines the full property-management workflow set for Roomflow.

It covers:

* the user goals behind property management
* the major property actions and subflows
* UI structure and navigation
* interaction details
* dos and don'ts
* validation rules
* edge cases
* permissions
* analytics and audit expectations
* visual/graphic concepts for the property area of the app

This document is focused on **ongoing product use**, not just onboarding.

---

# 1. Purpose of the property management area

In Roomflow, a property is not just a record in a database.
It is the main operating context for:

* house rules
  n- qualification questions
* lead routing
* communication defaults
* scheduling behavior
* source attribution
* analytics
* future automations and team assignments

The property management area should therefore function as a **command center** for each shared-house or room-rental location.

The property area must allow the user to:

* add new properties quickly
* understand the state of each property
* edit configuration safely
* clone repeatable setups
* archive inactive properties without losing history
* reassign leads between properties when needed

---

# 2. User types interacting with property management

## 2.1 Personal user

Typical needs:

* add one or more properties over time
* keep property setup simple
* reuse defaults where possible
* avoid operational clutter

## 2.2 Org owner/admin

Typical needs:

* manage many properties
* maintain consistency across properties
* assign properties to team members
* compare property performance
* archive, clone, and update configuration safely

## 2.3 Manager/operator

Typical needs:

* view assigned properties
* update rules and questions where permitted
* handle lead reassignment
* monitor active lead volume

## 2.4 Viewer/read-only role

Typical needs:

* inspect property configuration and active status
* review property-level analytics
* not make destructive changes

---

# 3. Property management workflows covered in this specification

This spec covers all major property workflows:

1. View properties list
2. View property detail
3. Add new property
4. Edit property
5. Manage property rules
6. Manage qualification questions
7. Manage property channel preferences
8. Manage property assignments and ownership context
9. Clone property
10. Archive property
11. Restore property
12. Delete property
13. Reassign lead across properties
14. Bulk property actions (Org later)

---

# 4. Navigation model for the property area

## 4.1 Top-level navigation

Main app nav includes:

* Dashboard
* Inbox
* Leads
* Properties
* Templates
* Calendar
* Analytics
* Settings

The `Properties` nav item leads to the property list page.

---

## 4.2 Properties list routes

Primary routes:

```text
/app/properties
/app/properties/new
/app/properties/[propertyId]
/app/properties/[propertyId]/edit
/app/properties/[propertyId]/rules
/app/properties/[propertyId]/questions
/app/properties/[propertyId]/channels
/app/properties/[propertyId]/settings
```

Possible later routes:

```text
/app/properties/[propertyId]/clone
/app/properties/[propertyId]/archive
/app/properties/[propertyId]/activity
/app/properties/[propertyId]/analytics
```

---

## 4.3 Navigation principles

### DO

* make `Properties` a first-class navigation destination
* keep list -> detail -> subsettings flow obvious
* keep property pages scoped clearly so the user always knows which property they are editing
* allow quick switching between properties

### DON'T

* bury property management under generic settings only
* force the user to remember property IDs or hidden workspace context
* make sub-pages feel disconnected from the main property detail page

---

# 5. Properties list workflow

## 5.1 Purpose

The properties list page is the user’s entry point to property management.
It should let the user:

* see all active properties
* understand their status quickly
* open a property
* add a property
* identify inactive/archived properties
* compare operational state at a glance

---

## 5.2 Page goals

The page must answer:

* what properties do I have?
* which ones are active?
* which ones need attention?
* which ones have active leads?
* which property should I open next?

---

## 5.3 Recommended layout

### Header row

Contains:

* page title: `Properties`
* short supporting text
* primary CTA: `Add property`

### Toolbar row

Contains:

* search
* filter by status
* filter by assignment (Org)
* sort menu
* archived toggle

### Main content area

Choose one of these modes:

* card grid for smaller accounts
* list/table view for Org and heavier use
* optional view switcher later

Recommended early behavior:

* Personal: card-forward layout
* Org: list/table default or toggle

---

## 5.4 Card/list content

Each property card or row should show:

* property name
* location label
* property type
* active/inactive/archive status
* rentable room count
* current active leads count
* current qualified leads count
* channel health summary
* last updated or recent activity

Optional badges:

* `Needs rules review`
* `No channels connected`
* `Archived`
* `Lead volume high`

---

## 5.5 Core user interactions

### Click property card/row

Route to property detail.

### Click Add property

Route to add property workflow.

### Open quick actions menu

Possible actions:

* View
* Edit
* Clone
* Archive
* Restore
* Delete (if allowed)

### Search

Search by:

* property name
* location
* type

### Filter

Filter by:

* active
* archived
* assigned to me
* no channels connected
* high lead volume

---

## 5.6 Empty states

### No properties yet

Show:

* illustration or calm empty-state icon
* text: `No properties yet`
* helper copy: `Create your first property to start routing and qualifying leads.`
* CTA: `Add property`

### No results after filtering

Show:

* text: `No properties match these filters`
* CTA: `Clear filters`

---

## 5.7 Dos and don'ts

### DO

* make the add-property CTA obvious
* show meaningful operational metadata
* allow fast scan of property health
* let the user distinguish active vs archived instantly
* support search even at modest scale

### DON'T

* overload list view with low-value metadata
* force the user into edit mode to understand basic property state
* hide archived properties completely
* use vague labels like `asset` or `unit group`

---

# 6. Property detail workflow

## 6.1 Purpose

The property detail page is the operating hub for one property.
It should answer:

* what kind of property is this?
* how is it configured?
* what is happening here right now?
* what needs attention?
* what should I do next?

---

## 6.2 Recommended layout

### Top header area

Show:

* property name
* location
* property status
* property type
* primary actions

Primary actions:

* Edit property
* Add lead manually
* Open rules
* Open questions
* More actions menu

### Summary cards row

Cards may include:

* Active leads
* Awaiting response
* Qualified leads
* Tours scheduled
* Channel status
* Last activity

### Main sections

Recommended sections:

1. Overview
2. Rules preview
3. Questions preview
4. Lead funnel summary
5. Channel/integration summary
6. Recent property activity

---

## 6.3 Core user interactions

### Edit property

Open edit flow.

### View rules

Jump to full rules management.

### View questions

Jump to question management.

### Add lead manually

Start manual lead creation pre-assigned to this property.

### View activity

Show recent property-level changes and lead activity.

### Quick actions menu

* Clone property
* Archive property
* Restore property
* Delete property
* Copy property link

---

## 6.4 Property overview content

Should include:

* property type
* location label
* rentable rooms count
* bathroom sharing context
* parking state
* smoking policy
* pets policy
* minimum stay preference
* furnished state
* property owner/manager assignment if relevant

This section should be compact and highly readable.

---

## 6.5 Rules preview section

Show a small structured summary:

* blocking rules count
* warning rules count
* informational rules count
* top 3 most important rules
* link to full rules editor

Example:

```text
Blocking
- No smoking
- No pets
- Bathroom sharing required

Warnings
- Minimum stay 6 months+
- Parking limited
```

---

## 6.6 Questions preview section

Show:

* required question count
* optional question count
* first few question labels
* link to full editor

---

## 6.7 Lead funnel summary

Show property-specific funnel counts:

* new
* awaiting response
* under review
* qualified
* tour scheduled
* application sent
* declined

This helps the user understand current operational state quickly.

---

## 6.8 Channel/integration summary

Show:

* email status
* SMS status
* calendar status
* manual mode if active
* source integrations later

Badges should be obvious:

* Connected
* Pending
* Not connected
* Degraded

---

## 6.9 Dos and don'ts

### DO

* make the property detail page feel like a command center
* keep actions close to top
* summarize configuration without forcing deep navigation
* show health and operational load

### DON'T

* make property detail a dead-end summary page
* force the user through multiple clicks to do common actions
* hide critical status like archived/no channels connected

---

# 7. Add new property workflow

## 7.1 Purpose

Allow an existing user to create another property outside onboarding.

This differs from onboarding because the user may already have:

* existing templates
* existing rulesets
* a preferred structure
* team setup
* prior properties to clone

---

## 7.2 Entry points

* Properties list -> Add property
* Dashboard CTA
* Empty state CTA
* Org expansion workflow

---

## 7.3 UX approach

The add-new-property workflow should look similar to onboarding property creation, but include more power-user shortcuts.

Recommended actions:

* Create from scratch
* Clone existing property
* Start from a recommended template

---

## 7.4 Page structure

### Header

`Add property`

### Choice block

Options:

* New property from scratch
* Clone an existing property
* Start from a recommended setup

### Form area

If `from scratch` is selected, show standard property creation form.
If `clone` is selected, show clone workflow.

---

## 7.5 Form fields

Same base fields as onboarding:

* property name
* property type
* location label
* rentable room count
* bathroom-sharing count/context
* parking availability
* smoking policy
* pets policy
* minimum stay preference
* furnished state

Optional Org-only additions later:

* assigned manager
* internal property code
* workspace tags

---

## 7.6 Dos and don'ts

### DO

* support cloning from existing property
* prefill sensible defaults if user has a common configuration pattern
* route user to property detail or setup continuation after save

### DON'T

* make the user repeat too much manual setup if cloning would help
* require rules/questions immediately in the same form unless user chooses template/clone path

---

# 8. Edit property workflow

## 8.1 Purpose

Allow the user to safely update core property information without breaking downstream workflows.

This workflow matters because edits may affect:

* fit logic
* question relevance
* lead handling
* AI suggestions
* reporting

---

## 8.2 Entry points

* property detail -> Edit property
* property quick action menu
* rules/questions page breadcrumb action later

---

## 8.3 UX structure

Recommended route:

```text
/app/properties/[propertyId]/edit
```

Layout:

* page header with property context
* editable grouped sections
* sticky save bar or bottom actions

Sections:

1. Basic details
2. Shared-living details
3. Preferences and fit-related settings
4. Advanced/internal settings later

---

## 8.4 Editable fields

Should allow editing:

* property name
* type
* location label
* rentable room count
* shared bathroom count/context
* parking availability
* smoking policy
* pets policy
* minimum stay preference
* furnished state
* active/archived state via separate action flow, not inline field

---

## 8.5 Save behavior

When the user saves edits, the system should:

1. validate inputs
2. save changed fields
3. detect whether changes affect qualification logic
4. if yes, queue recomputation or show warning
5. create activity/audit events
6. show success state

---

## 8.6 Dangerous change handling

Certain edits should trigger clear warnings.

### Example: changing smoking policy

If existing leads were evaluated under the old rule context, show message like:

```text
This change may affect how current leads are evaluated. Roomflow will recompute fit for relevant leads.
```

### Example: changing property type

Show:

```text
This may change recommended rules and qualification behavior, but your current rules will not be overwritten automatically.
```

### Example: changing location only

No special warning needed.

---

## 8.7 Dos and don'ts

### DO

* preserve user confidence when saving edits
* explain if a change affects downstream workflow
* keep unchanged sections calm and compact
* avoid surprising mutations to rules/questions

### DON'T

* silently rewrite house rules based on a property-type change
* hide that lead fit may need recomputation
* auto-archive or disable things due to simple edits

---

# 9. Manage property rules workflow

## 9.1 Purpose

Allow the user to create, edit, reorder, disable, and review the house rules for a property.

This is a more advanced version of the onboarding rules setup.

---

## 9.2 Entry points

* property detail -> Rules preview -> Manage rules
* property settings nav

---

## 9.3 UX layout

Recommended layout:

* property context header
* summary panel
* active rules grouped by severity
* add rule button
* custom rules section

Possible groupings:

* Blocking
* Warning
* Informational

---

## 9.4 Core interactions

* enable/disable rule
* change selected value
* change severity
* add custom rule
* delete custom rule
* reorder rules later if needed

---

## 9.5 Change handling

If a rule edit affects current leads, show a clear notice:

```text
This change may affect current fit evaluations for this property.
```

Then either:

* recompute automatically
* or allow manual recompute confirmation

For v1, automatic recompute with clear notice is fine.

---

## 9.6 Dos and don'ts

### DO

* group rules visually by severity or category
* surface the total blocker/warning count
* make edits reversible

### DON'T

* make rules feel buried under advanced settings
* make every rule look equally important

---

# 10. Manage qualification questions workflow

## 10.1 Purpose

Allow the user to update the intake question set for a property.

This is the post-onboarding version of Workflow 4.

---

## 10.2 Core interactions

* add question
* edit wording
* change required/optional/off
* reorder questions
* remove question
* restore recommended questions

---

## 10.3 UX layout

Recommended sections:

* required questions
* optional questions
* disabled/recommended questions
* preview panel

---

## 10.4 Key safety behavior

When a question is turned off that supports a key rule, show a warning:

```text
This question helps evaluate one of your active house rules.
Disabling it may reduce lead fit accuracy.
```

---

## 10.5 Dos and don'ts

### DO

* show which rules/questions are linked conceptually
* warn if user weakens the intake too much

### DON'T

* silently permit a zero-question setup without warning
* make reorder the only way to edit structure

---

# 11. Manage property channel preferences workflow

## 11.1 Purpose

Allow the user to control which communication channels a property prefers.

This is separate from workspace-level integrations.

Property-level preferences may include:

* default outbound channel
* whether SMS is allowed for this property
* calendar target
* reminder defaults later

---

## 11.2 Core interactions

* choose preferred default channel
* view channel availability
* connect missing channel if needed
* set manual-only state if desired

---

## 11.3 UX structure

This page should feel like preferences, not infrastructure.

Show:

* Email: Connected / Not connected
* SMS: Connected / Not connected
* Calendar: Connected / Not connected
* Preferred channel: Email / SMS

If a channel is unavailable, link to integration setup.

---

## 11.4 Dos and don'ts

### DO

* make clear distinction between workspace connection and property preference
* keep this page lightweight

### DON'T

* overload this page with provider-specific configuration

---

# 12. Manage property assignments workflow (Org)

## 12.1 Purpose

Let Org workspaces assign people to a property.

Examples:

* owner
* manager
* lead handler
* viewer

---

## 12.2 Core interactions

* assign manager
* add or remove collaborator access
* change property-level role later
* view assigned users

---

## 12.3 UX structure

Simple people-management section:

* assigned people list
* role badges
* add/remove controls

---

## 12.4 Dos and don'ts

### DO

* keep property assignments distinct from workspace membership
* show who is responsible for the property clearly

### DON'T

* create a confusing second identity system separate from workspace roles

---

# 13. Clone property workflow

## 13.1 Purpose

Allow the user to duplicate an existing property setup to save time.

This is one of the highest-value property power features.

---

## 13.2 Entry points

* property quick actions
* add property flow

---

## 13.3 Clone UX flow

1. user clicks `Clone property`
2. modal or page opens
3. user chooses what to copy
4. user enters new property name and location
5. system creates new property with selected copied configuration

---

## 13.4 Clone options

User may copy:

* basic property settings
* house rules
* qualification questions
* templates later
* channel preferences later
* automations later

Recommended defaults:

* copy rules = yes
* copy questions = yes
* copy channels = no by default
* copy leads = never
* copy analytics/history = never

---

## 13.5 Dos and don'ts

### DO

* make clone a major time saver
* keep copied content clearly scoped to the new property
* require a new property name

### DON'T

* copy live leads/messages
* create ambiguous duplicated location state without user confirmation

---

# 14. Archive property workflow

## 14.1 Purpose

Allow the user to remove a property from active operations while preserving its history.

Archiving should be the default alternative to deletion.

---

## 14.2 Entry points

* property quick actions
* property settings page

---

## 14.3 Archive UX flow

1. user clicks `Archive property`
2. confirmation modal appears
3. modal explains consequences
4. user confirms
5. property status becomes archived
6. property disappears from active default views

---

## 14.4 Archive consequences

Archived properties should:

* remain viewable if filters allow
* retain leads/history/analytics
* stop appearing in active add-lead/default routing contexts
* generally stop being selectable for new lead routing unless explicitly restored

Open question for implementation:

* what happens to active leads?

Recommended behavior:

* block archive if there are critical active states or show stronger confirmation
* or allow archive but mark leads as requiring review

Safer early behavior:

* warn strongly if active leads exist

---

## 14.5 Confirmation copy example

```text
Archive this property?
Archived properties are removed from active workflows, but their history stays محفوظ.
You can restore it later.
```

If active leads exist:

```text
This property still has active leads. Review them before archiving, or continue and mark this property inactive.
```

---

## 14.6 Dos and don'ts

### DO

* treat archive as reversible
* preserve history
* warn about active leads

### DON'T

* make archive destructive
* silently remove property from analytics history

---

# 15. Restore property workflow

## 15.1 Purpose

Allow the user to reactivate an archived property.

---

## 15.2 Core interactions

* user views archived property
* clicks `Restore property`
* property becomes active again
* property returns to active lists and routing context

---

## 15.3 Dos and don'ts

### DO

* make restoration easy
* preserve previous configuration

### DON'T

* force the user to rebuild setup after restore

---

# 16. Delete property workflow

## 16.1 Purpose

Support irreversible removal only in limited cases.

Delete should be rare.
Archive should be preferred.

---

## 16.2 Recommended delete policy

Allow delete only if:

* user has sufficient permission
* property has no active leads
* or the company’s policy allows deletion only after archive and cleanup

Safer early rule:

* if property has historical leads/messages, prefer archive only

---

## 16.3 Delete UX flow

1. user clicks `Delete property`
2. warning modal appears
3. consequences explained clearly
4. user types property name to confirm
5. deletion proceeds if allowed

---

## 16.4 Warning copy example

```text
Delete this property permanently?
This action cannot be undone.
If you want to preserve history, archive it instead.
```

---

## 16.5 Dos and don'ts

### DO

* make delete intentionally harder than archive
* require explicit confirmation
* explain archive as safer alternative

### DON'T

* allow casual destructive deletion from a quick menu without confirmation
* allow deletion that leaves orphaned leads/messages silently

---

# 17. Reassign lead across properties workflow

## 17.1 Purpose

Allow an operator to move a lead from one property context to another when it is a poor fit for the original assignment but may fit another property.

This is a major operational workflow.

---

## 17.2 Entry points

* lead detail page
* review queue
* property detail with active leads

---

## 17.3 Core UX flow

1. user opens lead detail
2. clicks `Reassign property`
3. modal opens with property search/select
4. user chooses destination property
5. system warns that fit will be recomputed
6. user confirms
7. lead is reassigned
8. fit/status recompute occurs
9. activity event logged

---

## 17.4 Post-reassignment behavior

After reassignment:

* lead retains message history and timeline
* property assignment changes
* fit result is recomputed against destination rules
* missing info may change
* review queue state may change

Example notice:

```text
This lead will be re-evaluated using the rules and qualification questions for the selected property.
```

---

## 17.5 Dos and don'ts

### DO

* preserve history
* make reassignment explicit and logged
* recompute fit and missing info automatically

### DON'T

* duplicate the lead unless user explicitly creates a copy flow later
* silently change status without surfacing recomputation effects

---

# 18. Bulk property actions (Org later)

## 18.1 Purpose

Allow Org users to perform multi-property management efficiently.

Possible actions:

* archive selected properties
* assign manager
* export list
* apply tags later

---

## 18.2 UX guidance

Bulk actions should only appear when:

* user has Org permissions
* multiple properties selected

Keep early bulk actions limited and safe.

---

# 19. Property status model

Recommended statuses:

* active
* archived
* draft later if needed

Do not overcomplicate with too many lifecycle states unless required.

Possible health indicators separate from status:

* no channels connected
* no rules configured
* no questions configured
* active leads high
* integration degraded

This lets status stay simple while health can be nuanced.

---

# 20. Permissions model for property actions

## 20.1 Owner/Admin

* add property
* edit property
* archive/restore/delete
* clone
* manage assignments
* reassign leads

## 20.2 Manager

* view assigned properties
* edit rules/questions/settings if policy allows
* reassign leads if permitted
* usually not delete property

## 20.3 Viewer

* view only
* no destructive actions

Permission checks must be enforced server-side.

---

# 21. Audit logging requirements

Every sensitive property action should create an activity/audit event.

Must log:

* property_created
* property_updated
* property_cloned
* property_archived
* property_restored
* property_deleted
* property_assignment_changed
* lead_reassigned_between_properties
* property_rules_updated
* property_questions_updated
* property_channel_preferences_updated

Each event should include:

* actor
* timestamp
* property ID
* old/new values where relevant
* reason or metadata if applicable

---

# 22. Analytics and operational metrics

Track:

* property count by workspace
* active vs archived property counts
* property creation rate
* property clone rate
* archive rate
* average leads per property
* properties without channel setup
* properties without rules/questions
* reassignment frequency between properties

These metrics help identify product gaps and operational friction.

---

# 23. UX and visual design concepts

## 23.1 Overall visual tone

The property area should feel:

* structured
* calm
* operational
* readable
* trustworthy

It should not feel like:

* real-estate marketplace UI
* finance/accounting UI
* generic CRUD admin panel

---

## 23.2 Graphic concepts for the properties list

### Concept A — Property cards as operational tiles

Each property appears as a large tile with:

* title and location at top
* status badge
* lead/funnel metrics as mini stats
* health badges at bottom

Good for Personal and small accounts.

### Concept B — Table/list with health chips

Each row includes:

* property name
* type
* status
* active leads
* qualified leads
* channels
* updated time
* quick action menu

Good for Org.

### Concept C — Hybrid list with left-aligned property identity and right-aligned metrics

This balances scanability and richness.

---

## 23.3 Graphic concepts for property detail page

### Hero strip

Top banner/card includes:

* property name
* location
* type
* status
* primary actions

### Summary card row

6 compact cards:

* Active leads
* Awaiting response
* Qualified
* Tours
* Channels
* Last activity

### Section cards below

* Rules card
* Questions card
* Funnel card
* Activity card

This creates a dashboard-like but focused experience.

---

## 23.4 Property health indicators

Use compact colored chips/badges such as:

* Active
* Archived
* No channels
* Needs rules
* Needs questions
* High activity
* Review needed later

Use badges sparingly; avoid badge overload.

---

## 23.5 Empty-state graphics

Use simple line/shape illustrations, not stock-real-estate imagery.
Examples:

* house outline + inbox icon
* property card stack + plus icon
* archive box icon for archived filter state

---

# 24. Accessibility guidance

Property workflows must support:

* keyboard navigation
* clear focus states
* accessible table/card actions
* accessible action menus
* labeled status badges where needed
* confirmation modals with proper focus trapping
* mobile-friendly action buttons

Do not rely on color alone to convey status.

---

# 25. Mobile behavior guidance

## 25.1 Properties list on mobile

Use stacked cards.
Key info only:

* name
* status
* location
* active leads
* action chevron/menu

## 25.2 Property detail on mobile

Use stacked sections.
Summary cards collapse into 2-column or vertical layout.
Primary actions should remain easy to reach.

## 25.3 Edit flows on mobile

Single-column forms.
Sticky save bar optional.
Confirmation modals must be simple and readable.

---

# 26. Dos and don'ts across the whole property management area

## DO

* make property management first-class
* keep actions obvious
* preserve history whenever possible
* prefer archive over delete
* support cloning early
* make property detail feel operationally rich
* clearly separate property data from property health
* make warnings explicit when edits affect lead fit

## DON'T

* turn property management into a dense admin maze
* hide common actions in too many menus
* make delete easy and archive hard
* auto-rewrite downstream configuration without warning
* force enterprise-level complexity on Personal users
* create a brittle room-level model too early

---

# 27. Recommended implementation order

## Phase 1

* Properties list
* View property detail
* Add property
* Edit property
* Archive/restore property

## Phase 2

* Manage rules
* Manage questions
* Channel preferences
* Reassign lead across properties

## Phase 3

* Clone property
* Assignment management for Org
* Bulk property actions
* richer analytics on property pages

Delete property should be implemented cautiously and later than archive.

---

# 28. Summary

Property management in Roomflow should behave like an operational layer, not a generic record editor.

A user should be able to:

* create properties quickly
* understand their current state instantly
* manage rules and intake logic safely
* scale setup through cloning
* remove properties from active use without losing history
* move leads between properties intelligently

The product should make property management feel:

* calm
* structured
* reversible where possible
* operationally useful
* clearly tied to the room-rental workflow engine
