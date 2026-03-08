## Workflow 5 — Connect Communication Channels

This is the workflow where Roomflow becomes **operationally live**.

Workflows 2–4 created the internal structure:

* property
* house rules
* qualification questions

Workflow 5 connects the **outside world** to that structure.

This workflow powers:

* real inbound lead handling
* outbound follow-up
* unified inbox
* message threading
* AI summaries on real conversations
* later automation

Without channels, Roomflow is a configured system.
With channels, Roomflow becomes a working tool.

---

# Purpose

The goal of this workflow is to let the user connect the communication channels Roomflow will use to:

* receive inquiries
* send replies
* thread conversations
* route leads into the inbox
* support later reminders and automations

This workflow should:

* make at least one channel usable
* keep setup simple
* avoid technical overload
* support a low-friction “manual mode” fallback
* move the user toward their first real lead

---

# Primary goals

1. connect at least one usable communication channel
2. make Roomflow feel real and live
3. support both inbound and outbound communication
4. preserve low-friction onboarding
5. route user into first-lead value quickly

---

# Secondary goals

* establish the unified inbox model
* let the user choose channel priority
* prepare later automation
* allow “skip for now” only if there is still a clear path to value

---

# Position in onboarding

Suggested sequence:

1. Sign up / workspace
2. Create first property
3. Define house rules
4. Define qualification questions
5. **Connect communication channels**
6. Add/import first lead

This is the first infrastructure-oriented onboarding step, so it must be very carefully designed.

---

# User mental model

The user should think:

```text
I’m telling Roomflow how leads will reach me and how I’ll reply to them.
```

Not:

```text
I’m configuring message infrastructure and webhooks.
```

This workflow must feel practical, not technical.

---

# Core channel types for v1

## 1. Email

This should be the first and easiest channel.

Use cases:

* receive inquiry replies
* send follow-ups
* send application invites
* send reminders

## 2. SMS

This is extremely valuable, but setup may be more complex.

Use cases:

* fast follow-up
* reminder messages
* short qualification questions
* time-sensitive coordination

## 3. Manual-only mode

This is important for low-capex / low-friction onboarding.

Use case:

* user doesn’t want to connect anything yet
* user wants to try product with manual lead entry
* user wants to validate workflow first

This fallback is very important.

---

# Channels to exclude from early onboarding

Do not include these in first-run onboarding:

* WhatsApp
* Instagram messaging
* Meta Lead Ads
* listing feed integrations
* voice/call integration
* Outlook
* webhooks
* screening integrations

Those belong later in settings/integrations, not first onboarding.

---

# Recommended route

Main route:

```text
/onboarding/channels
```

Later reachable from:

```text
/app/settings/integrations
/app/settings/channels
```

---

# Core UX strategy

This workflow should not force every user into a complex provider setup.

The best structure is:

## Option A — Connect email

Most recommended

## Option B — Connect email + SMS

Best setup

## Option C — Start in manual mode

Fastest fallback

This gives users a clear decision without paralysis.

---

# Page structure

## Header

```text
Connect your communication channels
```

## Supporting copy

```text
Choose how Roomflow should receive and send lead messages.
```

Optional helper:

```text
You can start with email and add more later.
```

---

# Recommended layout

Use **channel cards**, not a dense settings table.

Each card should explain:

* what the channel is for
* setup effort
* whether it supports inbound, outbound, or both
* whether it is recommended for launch

---

# Channel cards

## Email card

### Title

```text
Email
```

### Description

```text
Send follow-ups and keep lead conversations organized.
```

### Support label

```text
Recommended
```

### Capability labels

* outbound
* inbound replies later / if configured
* templates
* invites

### CTA

```text
Connect email
```

---

## SMS card

### Title

```text
Text messaging
```

### Description

```text
Use SMS for faster follow-up and reminders.
```

### Capability labels

* outbound
* inbound
* reminders
* fast response

### CTA

```text
Connect SMS
```

Secondary note:

```text
You can add this later
```

---

## Manual mode card

### Title

```text
Manual mode
```

### Description

```text
Start using Roomflow without connecting channels yet. You can add them later.
```

### CTA

```text
Continue without connecting
```

This is critical for reducing dropoff.

---

# Recommended default onboarding path

Best early recommendation:

```text
Connect email now
Add SMS later if needed
```

This is the best balance of:

* simplicity
* real value
* low capex
* fast build

---

# Email connection flow

This is the most important subflow.

## Purpose

Allow the user to send email from Roomflow and later receive replies in a structured way.

## v1 launch scope

For MVP, you can separate:

### Phase 1

* outbound email only

### Phase 2

* inbound reply handling / email threading

This matters because outbound is much easier to launch.

---

# Email connection UI

When user clicks:

```text
Connect email
```

Open either:

* modal
* dedicated setup step
* embedded setup panel

Recommended for onboarding:
**embedded setup panel** or guided mini-step.

---

## Email setup options

### Option 1 — Use a Roomflow-managed sending identity

Simplest for MVP if product supports basic sending.

### Option 2 — Connect/verify your own sending email/domain

Better long-term, more friction.

For early version, likely flow should be:

* collect sender name
* collect sender email
* explain verification if needed

---

# Email setup fields

## Basic fields

* sender name
* sender email

Optional later:

* reply-to email
* custom domain

---

# Email UX flow

1. user chooses email
2. enters sender name/email
3. system validates format
4. system saves email channel config
5. verification email may be sent if required
6. success state shown
7. user can continue onboarding

---

# Email setup dos

## DO

* keep email setup simple
* explain that they can edit later
* support sender identity clearly
* validate email format immediately
* show connection status simply:

  * not connected
  * pending verification
  * connected

## DON’T

* expose provider jargon
* ask for SMTP credentials in onboarding
* ask for DNS records in first-run onboarding unless absolutely necessary
* make users configure advanced deliverability settings now

---

# Email connection status states

## Not connected

No usable email setup exists.

## Pending verification

Email saved, but verification required.

## Connected

Ready to send.

## Degraded

Previously connected but now invalid or blocked.

---

# Success state after email connection

Show:

```text
Email connected
You can now send follow-ups from Roomflow.
```

CTA:

```text
Continue
```

Optional secondary:

```text
Add SMS too
```

---

# SMS connection flow

This is more advanced, so onboarding must keep it optional and clear.

## Purpose

Enable faster, more conversational lead follow-up.

## v1 role

SMS is valuable, but should not block product adoption.

---

# SMS setup UI

When user clicks:

```text
Connect SMS
```

Show compact explanation:

```text
Use SMS for faster replies, reminders, and short qualification follow-ups.
```

Then either:

* guided setup panel
* mark as “set up later” if provider complexity is not ready for MVP

---

# SMS setup fields

Depending on provider model, likely fields:

* phone number selection or assignment
* country/region if relevant
* sender display explanation
* agreement/consent awareness note

But for onboarding, keep it to the minimum possible.

---

# SMS setup dos

## DO

* explain setup is optional
* explain SMS may involve usage costs
* explain that consent and opt-outs matter
* let the user defer

## DON’T

* dump provider compliance jargon on this screen
* require full A2P education inside onboarding
* block onboarding if SMS isn’t configured

---

# SMS connection status states

## Not connected

No SMS available.

## Pending setup

Partially configured but not live.

## Connected

Can send and receive.

## Restricted

Connected but messaging limited because of provider/compliance state.

This is useful later, though maybe too much detail for the first onboarding UI.

---

# Manual mode flow

This is crucial.

## Purpose

Let a user continue onboarding and use Roomflow even if they do not connect channels yet.

## Why it matters

* lowers friction
* lowers early abandonment
* supports first-time landlord / hesitant buyer
* supports demo/testing behavior
* matches low-capex users

---

# Manual mode UX

When user clicks:

```text
Continue without connecting
```

Show confirmation:

```text
You can still add leads manually and use Roomflow’s workflow tools.
You can connect email or text later.
```

Buttons:

* Continue in manual mode
* Go back

---

# Manual mode effects

If chosen:

* property remains active
* qualification workflow remains active
* inbox may be limited
* first lead import/manual entry becomes next step
* messaging features are partially disabled or marked unavailable

This is acceptable as long as the next step still feels valuable.

---

# Navigation behavior

## Primary actions

Depends on channel state.

### If no channel connected

User may:

* connect email
* connect SMS
* continue manual mode

### If at least one usable channel exists

Primary CTA becomes:

```text
Save and continue
```

Next route:

```text
/onboarding/first-lead
```

or

```text
/onboarding/import-lead
```

---

## Back action

Route:

```text
/onboarding/questions
```

---

# Good onboarding progression after this workflow

Once this is done, the next ideal step is:

## Workflow 6 — Add or import first lead

Because the user now has:

* property
* rules
* question set
* channel option or manual mode

Now they can actually see Roomflow work.

---

# UX interaction details

## Channel card hover/click behavior

* card highlights on hover
* clicking CTA opens the corresponding setup flow
* selected channel card may show expanded configuration

## Connected state in card

Show a badge:

```text
Connected
```

or

```text
Manual mode enabled
```

This gives visual reassurance.

---

# Settings saved by this workflow

For each connected channel, create records like:

```text
channel_id
workspace_id
channel_type
status
config_json
verification_state
created_at
updated_at
```

Examples:

* email channel config
* SMS channel config

For manual mode:

```text
workspace.manual_mode = true
```

or equivalent onboarding state marker.

---

# Activity logging

Create events:

* channel_connection_started
* email_channel_connected
* email_channel_verification_pending
* sms_channel_connected
* manual_mode_selected
* channel_connection_skipped

These are useful for onboarding analytics.

---

# Validation rules

## Email

* sender email valid format
* sender name non-empty if required
* duplicate workspace email channel not created accidentally

## SMS

* if number provided, must be valid format
* if SMS setup incomplete, mark pending instead of broken

## Manual mode

* no extra validation required

---

# Error states

## Email invalid

```text
Please enter a valid email address.
```

## Email provider failure

```text
We couldn’t connect your email right now. You can try again or continue in manual mode.
```

## SMS failure

```text
We couldn’t finish SMS setup. You can continue and add it later.
```

This is important: failure should not trap the user.

---

# Accessibility requirements

Must support:

* keyboard navigation
* clear card labels
* proper status announcements
* form labels
* accessible modals/panels
* visible error text

---

# Mobile behavior

This workflow should be mobile-friendly.

Recommended:

* stacked cards
* expandable setup sections
* no side-by-side dense config
* sticky continue CTA optional

Avoid:

* complex modal nesting
* tiny toggles or provider-specific setup screens

---

# AI role in this workflow

AI should play almost no visible role here.

Possible use:

* suggest “email first” as simplest path
* later suggest best next step after channel connection

But do not make this workflow feel AI-heavy.

This is infrastructure setup and should remain calm.

---

# Dos for this workflow

## DO

* prioritize email
* make SMS optional
* include manual mode
* keep setup non-technical
* make “connected” status very obvious
* let users defer advanced channels
* ensure failure doesn’t block progress

## DO

* explain benefits in user language
* route quickly to first-value workflow
* use plain words like “email” and “text messaging”

---

# Don’ts for this workflow

## DON’T

* require all channels
* expose provider complexity too early
* ask for advanced deliverability details
* force DNS setup in onboarding
* force SMS if email is enough
* make manual mode feel second-class or broken
* show too many future integrations here

---

# Suggested copy examples

## Header

```text
Connect your communication channels
```

## Helper text

```text
Choose how Roomflow should receive and send lead messages.
```

## Email card note

```text
The easiest way to get started.
```

## Manual mode note

```text
You can still use Roomflow and connect channels later.
```

---

# Analytics events

Track:

* channels_step_started
* email_connect_clicked
* email_connected
* sms_connect_clicked
* sms_connected
* manual_mode_selected
* channels_step_completed
* onboarding_channels_abandoned

Useful dimensions:

* signup method
* plan type
* property type
* source campaign

---

# Success criteria

This workflow is successful if:

* user connects at least one channel or intentionally chooses manual mode
* user understands what Roomflow can do next
* user reaches first-lead workflow with confidence
* channel setup does not create major dropoff

---

# Product risks

## Risk 1: too much setup friction

Fix:

* prioritize email
* make SMS optional
* include manual mode

## Risk 2: users don’t understand why channels matter

Fix:

* explain operational value simply

## Risk 3: provider failures kill onboarding

Fix:

* graceful fallback
* allow continue without channel

## Risk 4: too many choices

Fix:

* keep early onboarding to email, SMS, manual mode only

---

# Completion criteria

Workflow 5 is complete when:

* at least one channel is usable or manual mode is selected
* channel configuration records exist where relevant
* activity events are logged
* user is routed to add/import first lead

---

# Final summary

Workflow 5 should feel like:

**“Tell Roomflow how you want to talk to leads so it can start doing real work.”**

It should be:

* simple
* forgiving
* practical
* low-friction
* clearly connected to the next value moment

It should not feel like:

* configuring infrastructure
* setting up enterprise messaging tools
* wrestling with providers before seeing value

The ideal user reaction is:

**“Okay, I’m ready to try this with a real inquiry.”**

Next would be:

## Workflow 6 — Add or Import First Lead
