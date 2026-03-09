# Roomflow — Lead and People Management Workflows Specification

This document defines the full lead-management and people-management workflow set for Roomflow.

It covers:

* adding leads
* importing leads
* viewing and managing lead records
* inbox triage and communication workflows
* qualifying, routing, archiving, merging, and reassigning leads
* adding people to a workspace
* inviting, assigning, changing roles, deactivating, and removing people
* UI structure and navigation
* interaction details
* dos and don'ts
* validation rules
* permissions
* audit and analytics expectations
* visual/graphic concepts for leads and people areas

This document is focused on operational usage after initial setup.

---

# 1. Purpose of lead and people management

Roomflow exists to help users manage room-rental leads and shared-housing operations.

That means two management surfaces are central to the product:

* **Leads**: prospects, their conversations, fit, status, tasks, and next steps
* **People**: the users/operators inside the workspace who collaborate on those leads and properties

The product should make both areas feel:

* structured
* operational
* auditable
* easy to scan
* low friction for common actions

The system should support:

* solo operation in Personal
* collaborative operation in Org

---

# 2. User types interacting with these workflows

## 2.1 Personal user

Typical needs:

* add leads manually or from channels
* review AI extraction and missing info
* send follow-ups quickly
* qualify or decline leads
* archive or merge duplicate leads
* no team/people management beyond self

## 2.2 Org owner/admin

Typical needs:

* manage all leads across multiple properties
* assign leads to teammates
* invite and manage people
* maintain role discipline
* reassign and audit changes

## 2.3 Manager/operator

Typical needs:

* work inbox and review queue
* manage assigned leads
* send messages
* schedule tours
* reassign leads if permitted
* collaborate with teammates

## 2.4 Viewer

Typical needs:

* read lead records and property context
* review activity/analytics if permitted
* no destructive or communication actions

---

# 3. Workflow families covered

## 3.1 Lead workflows

1. View leads list
2. View lead detail
3. Add lead manually
4. Import leads (CSV/manual batch)
5. Ingest lead from connected channel
6. Review AI extraction and normalization
7. Complete qualification / request missing info
8. Send message / follow-up
9. Route lead status
10. Review queue workflow
11. Reassign lead across properties
12. Assign lead to teammate
13. Merge duplicate leads
14. Archive lead
15. Restore lead
16. Delete lead (rare / tightly controlled)
17. Schedule tour / send invite / launch screening from lead

## 3.2 People workflows

1. View people list
2. Invite person to workspace
3. Accept invite / join workspace
4. Edit role / permissions
5. Assign people to properties or leads
6. Deactivate person
7. Remove person from workspace
8. View user activity and access state
9. Revoke sessions / security actions later

---

# 4. Navigation model

## 4.1 Main app navigation

Main nav includes:

* Dashboard
* Inbox
* Leads
* Properties
* Templates
* Calendar
* Analytics
* Settings

For Org, `People` may appear either:

* under Settings > Team
* or as a first-class top-level nav if team usage is heavy

Recommended early approach:

* Leads as top-level nav
* People inside Settings > Team

---

## 4.2 Routes

### Leads

```text
/app/leads
/app/leads/new
/app/leads/import
/app/leads/[leadId]
/app/leads/[leadId]/edit (minimal, if needed)
/app/leads/[leadId]/activity
```

### Inbox

```text
/app/inbox
```

### Review queue (may be under leads)

```text
/app/leads/review
```

### People

```text
/app/settings/team
/app/settings/team/invite
/app/settings/team/[memberId]
```

---

# 5. Leads list workflow

## 5.1 Purpose

The leads list is the structured management surface for all prospect records.

It should answer:

* who are my leads?
* what status are they in?
* which property are they tied to?
* which ones need action?
* who owns them internally?

---

## 5.2 Recommended layout

### Header

* page title: `Leads`
* supporting text
* primary CTA: `Add lead`
* secondary CTA: `Import leads`

### Filter toolbar

* search
* property filter
* status filter
* fit filter
* source filter
* assignment filter (Org)
* archived toggle
* sort menu

### Main content

Recommended early default:

* list/table view

Optional later:

* board/pipeline view toggle

---

## 5.3 Lead row content

Each row should show:

* lead name or identifier
* property
* source
* current status
* fit result
* assigned teammate (Org)
* last activity time
* next action or missing info indicator

Useful badges:

* Awaiting response
* Review needed
* Duplicate possible
* Stale
* Screening pending

---

## 5.4 Core interactions

* click row -> open lead detail
* quick actions menu:

  * View
  * Message
  * Reassign
  * Archive
  * Merge
  * Delete if allowed
* bulk selection later for Org

---

## 5.5 Empty states

### No leads yet

Show:

* `No leads yet`
* helper copy: `Add your first lead or connect a communication channel to start receiving inquiries.`
* CTA: `Add lead`
* CTA: `Import leads`

### No results from filters

Show:

* `No leads match these filters`
* CTA: `Clear filters`

---

## 5.6 Dos and don'ts

### DO

* make status and fit visible separately
* let users scan urgency quickly
* keep add/import actions obvious

### DON'T

* hide operational urgency behind too many clicks
* overload the list with every field in the schema
* collapse fit and status into one confusing label

---

# 6. Lead detail workflow

## 6.1 Purpose

The lead detail page is the main operating record for one prospect.

This is where the user should be able to:

* understand the lead instantly
* review conversation history
* review extracted info and fit
* take next actions
* collaborate internally

---

## 6.2 Recommended layout

### Header strip

Show:

* lead name
* property
* status badge
* fit badge
* assigned teammate (Org)
* primary actions

Primary actions:

* Message lead
* Request missing info
* Reassign property
* Qualify / Move status
* More actions

### Main content layout

Recommended two-column layout on desktop:

#### Left/main column

* summary card
* conversation thread
* activity timeline
* tasks/review items

#### Right side rail

* extracted lead info
* missing info checklist
* fit explanation
* property context snapshot
* quick actions

On mobile, side rail stacks below summary and thread.

---

## 6.3 Summary card

Should include:

* who the person is
* source
* when they inquired
* current status
* current fit result
* AI summary
* next best action if available

---

## 6.4 Extracted info section

Should show normalized fields like:

* email
* phone
* move-in date
* budget
* intended stay
* smoking
* pets
* bathroom sharing comfort
* parking need
* guest expectations
* work schedule notes

Each value may show:

* confidence state
* source/evidence note
* accepted/edited state

---

## 6.5 Missing info checklist

Should show only missing required or useful optional fields.

Examples:

* budget missing
* stay length missing
* bathroom-sharing answer missing

Actions:

* ask missing questions
* mark as intentionally unknown if needed later

---

## 6.6 Conversation section

This is one of the core work surfaces.

Should support:

* full unified thread across connected channels
* message type labels (email, SMS, internal note)
* timestamps
* delivery/read markers where available
* compose box / draft action

---

## 6.7 Activity timeline

Should record:

* lead created
* source attached
* extraction accepted
* message sent/received
* status changed
* fit recomputed
* lead reassigned
* tour scheduled
* screening launched
* archive/restore actions

---

## 6.8 Dos and don'ts

### DO

* make the page action-oriented
* keep key state visible without scrolling too much
* make internal/external actions clearly distinct

### DON'T

* bury conversation history
* make the side rail too noisy
* hide reassign/merge/archive under obscure menus if frequently used

---

# 7. Add lead manually workflow

## 7.1 Purpose

Allow a user to create a lead even if it did not come in through an integration.

This is important for:

* early product use
* manual migration
* phone/in-person inquiries
* copied leads from outside systems

---

## 7.2 Entry points

* Leads list -> Add lead
* Property detail -> Add lead
* Dashboard CTA
* Empty-state CTA

If launched from a property page, preassign the property.

---

## 7.3 UX approach

This should be a short form, not a massive data-entry screen.

Recommended fields:

* lead name
* email and/or phone
* assigned property
* source
* inquiry message or notes
* move-in date optional
* budget optional

Optional convenience:

* paste inquiry text -> run AI extraction after save

---

## 7.4 Smart mode

Best behavior:

* user pastes inquiry text
* user enters minimal contact info
* Roomflow creates lead
* AI extracts likely structured fields
* user reviews the result in lead detail

This is much better than forcing full manual field entry up front.

---

## 7.5 Validation rules

Require at least:

* property
* one identifying field or inquiry body

Examples of valid minimums:

* name + email
* phone + inquiry body
* inquiry body + property + temporary unknown name

If no contact path exists, warn but allow save in limited manual mode if the note is still useful.

---

## 7.6 Dos and don'ts

### DO

* make manual lead add fast
* support pasted inquiry text
* allow partial info
* preassign property when possible

### DON'T

* require full structured completion before save
* force all qualification fields up front

---

# 8. Import leads workflow

## 8.1 Purpose

Allow users to bring multiple leads into Roomflow from CSV or manual batch workflows.

---

## 8.2 Entry points

* Leads list -> Import leads
* Setup/onboarding continuation later

---

## 8.3 UX structure

Recommended staged flow:

1. Upload CSV
2. Field mapping
3. Validation preview
4. Import confirmation
5. Results summary

---

## 8.4 Supported columns early

* name
* email
* phone
* property
* source
* notes/inquiry text
* status optionally
* move-in date optionally
* budget optionally

---

## 8.5 Validation behavior

Show:

* valid rows
* rows with missing required mappings
* duplicate warnings
* unmapped columns

Import should support:

* skip invalid rows
* import with warnings
* download error report later

---

## 8.6 Dos and don'ts

### DO

* make field mapping explicit
* support duplicate warnings
* provide import summary after completion

### DON'T

* silently drop rows without explanation
* assume perfect source data

---

# 9. Ingest lead from connected channel workflow

## 9.1 Purpose

Turn inbound messages or webhooks into lead records and threads.

---

## 9.2 Core behavior

When inbound channel data arrives:

1. identify workspace/channel
2. attempt lead match
3. attach to existing lead if matched
4. otherwise create new lead
5. attach thread/message
6. run AI extraction/summarization
7. update inbox and activity timeline

---

## 9.3 Expected UX result

User should see in inbox/leads:

* new lead appears or existing one updates
* source preserved
* summary visible shortly
* missing info and fit state update

---

## 9.4 Dos and don'ts

### DO

* preserve raw incoming message
* show source/channel clearly
* make duplicate handling cautious

### DON'T

* auto-merge with low confidence silently
* lose original message metadata

---

# 10. AI extraction review workflow

## 10.1 Purpose

Allow the user to review and accept or edit structured data extracted from lead messages.

---

## 10.2 UX structure

This should live in the lead detail side rail.

Fields show:

* extracted value
* confidence indicator
* source/evidence
* edit control
* accept state

User actions:

* accept value
* edit value
* reject value
* mark as unknown

---

## 10.3 Dos and don'ts

### DO

* make extraction review optional but useful
* allow easy corrections
* preserve original message context

### DON'T

* overwrite trusted values silently
* make confidence indicators cryptic

---

# 11. Qualification completion / request missing info workflow

## 11.1 Purpose

Help the user move a lead from partial data to a complete enough state for routing.

---

## 11.2 Core behavior

System should:

* compare lead data against property question set and rules
* identify missing required fields
* offer message actions to request them
* update completeness state once answers arrive

---

## 11.3 UX interactions

Buttons may include:

* Ask missing questions
* Mark as under review
* Continue manually

If the user clicks `Ask missing questions`:

* draft generated message appears
* user edits/sends
* status changes to awaiting response or incomplete

---

## 11.4 Dos and don'ts

### DO

* make missing required fields obvious
* support one-click draft generation

### DON'T

* treat optional data as blocker unless configured

---

# 12. Send message / follow-up workflow

## 12.1 Purpose

Let the user contact a lead directly from Roomflow.

---

## 12.2 Entry points

* inbox thread
* lead detail quick action
* review queue
* reminder/task cards later

---

## 12.3 Message UX

Composer should support:

* channel selection where relevant
* message body
* AI draft button
* template insert
* variable rendering preview
* send / save draft

Formal send types later:

* normal reply
* application invite
* screening invite
* reminder
* decline notice

---

## 12.4 Dos and don'ts

### DO

* keep send flow fast
* differentiate internal notes vs external messages clearly
* show delivery status later where available

### DON'T

* make every send feel like email marketing software
* hide channel choice if user has multiple connected channels

---

# 13. Route lead status workflow

## 13.1 Purpose

Allow the user to move a lead through the funnel in a clear, auditable way.

---

## 13.2 Core statuses

Recommended statuses:

* new
* awaiting_response
* incomplete
* under_review
* qualified
* caution
* tour_scheduled
* application_sent
* declined
* archived
* closed

Fit result remains separate.

---

## 13.3 UI model

Status can be changed via:

* quick action dropdown in lead header
* pipeline action buttons
* contextual prompts after messages/reviews

Changing status should:

* confirm important transitions where needed
* create audit event
* trigger side effects only if configured

---

## 13.4 Dos and don'ts

### DO

* keep status changes explicit
* separate status from fit visibly

### DON'T

* silently shift status because of minor UI actions
* collapse mismatch/caution into status confusion

---

# 14. Review queue workflow

## 14.1 Purpose

Provide a focused work surface for leads that need human judgment.

Typical reasons:

* caution rule triggered
* mismatch found
* duplicate suspected
* missing critical data
* conflict in answers
* screening completed

---

## 14.2 Layout

Review queue can be:

* filtered Leads view
* dedicated `/app/leads/review` page

Recommended columns/cards:

* lead name
* property
* reason for review
* current status
* fit state
* last activity
* owner/assignee

---

## 14.3 Actions

* open lead
* assign to teammate
* request more info
* qualify manually
* decline
* merge duplicate
* reassign property

---

## 14.4 Dos and don'ts

### DO

* make review reasons explicit
* allow queue triage without opening every record

### DON'T

* mix review queue with normal leads without a clear filter path

---

# 15. Reassign lead across properties workflow

## 15.1 Purpose

Move one canonical lead to a different property context.

---

## 15.2 UX flow

1. user clicks `Reassign property`
2. property selector appears
3. select target property
4. warning explains fit/missing info will be recomputed
5. confirm
6. lead updates

---

## 15.3 After effects

* property changes
* fit recomputes
* missing questions may change
* activity event added

---

# 16. Assign lead to teammate workflow (Org)

## 16.1 Purpose

Allow a lead to be owned or handled by a specific person.

---

## 16.2 Entry points

* lead detail
* leads list quick action
* review queue
* inbox later

---

## 16.3 UX flow

* choose assignee from workspace members
* optional note
* save

Show current assignee in header.

---

## 16.4 Dos and don'ts

### DO

* make assignment easy and visible
* allow reassignment

### DON'T

* hide ownership state
* allow assignment to unauthorized/inactive users

---

# 17. Merge duplicate leads workflow

## 17.1 Purpose

Resolve likely duplicate lead records without losing history.

---

## 17.2 Entry points

* duplicate banner on lead detail
* review queue
* lead quick action later

---

## 17.3 UX flow

1. user sees duplicate suggestion
2. opens merge comparison modal/page
3. sees side-by-side comparison:

   * names
   * contact fields
   * messages
   * property
   * source
4. chooses canonical field values if conflict exists
5. confirms merge

---

## 17.4 Merge behavior

* preserve all messages and activity
* preserve source history
* one surviving canonical lead record
* create merge audit event

---

## 17.5 Dos and don'ts

### DO

* require explicit confirmation
* show conflicts clearly
* preserve history

### DON'T

* auto-merge low-confidence duplicates
* lose message history or timestamps

---

# 18. Archive lead workflow

## 18.1 Purpose

Remove a lead from active operational views without deleting history.

---

## 18.2 UX flow

* user clicks Archive
* confirmation if needed
* lead status becomes archived
* lead disappears from active default views
* history retained

---

## 18.3 Dos and don'ts

### DO

* make archive reversible
* prefer archive over delete

### DON'T

* treat archive as hidden deletion

---

# 19. Restore lead workflow

## 19.1 Purpose

Allow archived lead to return to active workflow.

## 19.2 Behavior

* restore sets status to sensible previous or default state
* activity event logged

---

# 20. Delete lead workflow

## 20.1 Purpose

Support rare irreversible removal under strict controls.

Recommended early policy:

* avoid delete except for obvious junk/test data or strict admin-only cases
* prefer archive

---

## 20.2 UX flow

* destructive confirmation modal
* explain history loss or retention implications
* require typed confirmation for destructive delete if enabled

---

# 21. People list workflow

## 21.1 Purpose

Provide a view of all workspace members and their current access state.

---

## 21.2 Layout

Settings > Team page should show:

* member name
* email
* role
* status (active/invited/deactivated)
* last active date later
* assigned properties count later
* quick actions

Primary CTA:

* Invite person

---

## 21.3 Empty state

For Org with no extra members:

* `No teammates yet`
* helper copy
* CTA: `Invite teammate`

For Personal:

* either hide team page or show upgrade prompt if accessed

---

# 22. Invite person workflow

## 22.1 Purpose

Add a new person to the workspace.

---

## 22.2 Entry points

* Team page -> Invite person
* property assignment surfaces later

---

## 22.3 UX flow

Fields:

* email
* role
* optional property scope later
* optional note later

Flow:

1. owner/admin enters email + role
2. invite sent
3. invited state appears in team list
4. recipient accepts invite through email link
5. membership becomes active

---

## 22.4 Dos and don'ts

### DO

* keep invite flow simple
* make role implications visible
* show invited/pending clearly

### DON'T

* overload with too many team settings at invite time

---

# 23. Accept invite / join workspace workflow

## 23.1 Purpose

Allow invitee to join correctly without account confusion.

---

## 23.2 UX flow

1. invitee opens link
2. sees workspace name and role
3. logs in or signs up
4. accepts invite
5. routed into workspace

Should preserve invite context across auth flow.

---

# 24. Edit role / permissions workflow

## 24.1 Purpose

Allow Org owners/admins to change a member’s role.

---

## 24.2 UX flow

* open person details or quick action
* choose new role
* confirm if reducing or elevating permissions materially
* save

Roles may include:

* owner
* admin
* manager
* viewer

---

## 24.3 Dos and don'ts

### DO

* show role descriptions
* warn for major permission changes

### DON'T

* allow accidental owner transfer without stronger confirmation later

---

# 25. Assign people to properties or leads workflow

## 25.1 Purpose

Connect users to operational responsibility.

---

## 25.2 Property assignment behavior

A person may be assigned to a property as:

* manager
* collaborator/viewer later

## 25.3 Lead assignment behavior

Lead assignment indicates who is currently handling it.

---

## 25.4 UX expectations

* assignments visible on both person and lead/property pages later
* selecting from inactive users blocked

---

# 26. Deactivate person workflow

## 26.1 Purpose

Temporarily disable a member’s access without fully removing historical association.

---

## 26.2 Behavior

* user can no longer log in to workspace
* assignments remain historically linked
* active leads may need reassignment warning
* status shown as deactivated

---

## 26.3 Dos and don'ts

### DO

* warn about owned leads/tasks
  n- preserve historical activity association

### DON'T

* silently orphan assignments

---

# 27. Remove person from workspace workflow

## 27.1 Purpose

Fully remove a member’s access when appropriate.

---

## 27.2 UX flow

1. owner/admin clicks Remove
2. modal explains consequences
3. if open assignments exist, require reassignment or explicit confirmation
4. remove access
5. activity event logged

---

## 27.3 Dos and don'ts

### DO

* require confirmation
* handle assignment fallout clearly

### DON'T

* remove user and leave active operational objects unclear

---

# 28. View person detail workflow

## 28.1 Purpose

Allow admins to understand a member’s state.

Should show:

* name/email
* role
* status
* invited/accepted dates
* assigned properties count
* assigned leads count later
* recent activity later

---

# 29. Permissions model

## 29.1 Lead actions

### Owner/Admin

* all lead actions

### Manager

* most operational lead actions if permitted

### Viewer

* read-only

## 29.2 People actions

### Owner

* full team management

### Admin

* invite/edit most roles except certain ownership changes later

### Manager/Viewer

* no people-management actions by default

Server-side enforcement is required.

---

# 30. Audit logging requirements

Lead events to log:

* lead_created
* lead_imported
* lead_updated
* lead_assigned
* lead_reassigned_property
* lead_merged
* lead_archived
* lead_restored
* lead_deleted
* status_changed
* fit_recomputed
* message_sent
* message_received

People events to log:

* member_invited
* invite_accepted
* role_changed
* member_deactivated
* member_removed
* property_assignment_changed

Each event should include actor, object, timestamp, and relevant before/after values.

---

# 31. Analytics expectations

Track:

* lead creation rate
* import rate
* duplicate merge rate
* archive rate
* reassignment rate
* average time to first response
* leads per property
* leads per assignee (Org)
* invite acceptance rate
* team size per workspace
* role distribution

---

# 32. UX and visual design concepts

## 32.1 Leads list visual concepts

### Concept A — clean table with status + fit chips

Best for scanability.

### Concept B — split list with urgency icons

Useful if review/stale actions become common.

### Concept C — pipeline board later

Good for optional visual workflow, not required early.

---

## 32.2 Lead detail visual concepts

* strong header strip
* conversation as primary center column
* structured info side rail
* summary card near top
* fit/missing-info panel with clear chips

---

## 32.3 People list visual concepts

* lightweight member rows/cards
* role badge + status badge
* clear invite CTA
* simple action menu

---

## 32.4 Graphic language

Leads should look dynamic and active.
People should look administrative but human.
Avoid stock avatar-heavy gimmicks.
Use badges, timelines, and small summary cards.

---

# 33. Accessibility guidance

The lead and people areas must support:

* keyboard nav
* accessible tables/lists
* labeled action menus
* clear status indicators not relying only on color
* modal focus trapping
* screen-reader-friendly timeline labeling
* accessible compose forms

---

# 34. Mobile behavior guidance

## 34.1 Leads list

Use stacked cards instead of wide table where needed.
Show:

* name
* property
* status
* fit
* last activity
* quick action

## 34.2 Lead detail

Stack:

* summary
* actions
* conversation
* extracted info
* activity

## 34.3 People list

Use simple rows/cards with role/status and overflow menu.

---

# 35. Dos and don'ts across the whole area

## DO

* make lead actions fast
* keep lead detail highly actionable
* preserve history during merges and reassignment
* make invite and role flows straightforward
* keep people management simpler than lead management

## DON'T

* overload lead create/edit with too many fields
* hide fit vs status distinction
* make team management feel like enterprise IAM on day one
* allow destructive actions without confirmation

---

# 36. Recommended implementation order

## Phase 1

* Leads list
* Lead detail
* Add lead manually
* Inbox thread
* Message send/reply
* Status changes
* Archive/restore lead
* Team page basic (Org)
* Invite person
* Accept invite

## Phase 2

* Import leads
* AI extraction review
* Review queue
* Reassign lead across properties
* Assign lead to teammate
* Edit role
* Deactivate/remove person

## Phase 3

* Merge duplicate leads
* Bulk actions
* person detail analytics/activity
* richer team/property assignment flows

Delete lead should come later and remain tightly controlled.

---

# 37. Summary

Lead management in Roomflow should feel like the core operating engine of the product.

A user should be able to:

* add leads quickly
* see what matters immediately
* communicate from one place
* move leads through a clear funnel
* review ambiguity and resolve it safely
* collaborate with teammates when needed

People management should feel simpler and more administrative:

* invite
* role
* access
* assignment
* deactivation/removal

Together, these workflows should make Roomflow feel like a calm but capable operations system for room-rental lead handling and team coordination.
