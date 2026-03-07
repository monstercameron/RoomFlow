# Roomflow — Integrations Platform Specification

This document defines the **integrations platform** for Roomflow as a first-class product feature.

The goal is to make integrations a major differentiator by turning Roomflow into the operating layer that connects:

* lead sources
* messaging channels
* calendars
* listing distribution systems
* screening providers
* workflow tools
* import/export endpoints

This should be treated as a major product capability, not just a few adapters.

---

# 1. Product thesis

Roomflow is strongest when it becomes the **control plane** for room-rental and shared-housing workflows.

That means Roomflow should not only manage leads internally.
It should also:

* ingest inquiries from external channels
* push data to external systems
* keep message history synchronized
* trigger downstream actions like tours and screening
* provide one normalized lead record across all sources

The integration layer is therefore a core product surface.

---

# 2. Strategic outcomes

The integrations platform should achieve five outcomes:

## 2.1 Centralize inbound lead flow

All important lead sources should flow into one Roomflow lead record.

## 2.2 Reduce manual copy/paste work

Operators should not need to move data between email, text, listing sites, screening tools, and calendars.

## 2.3 Increase channel coverage

Roomflow should support both direct integrations and fallback ingestion paths.

## 2.4 Create lock-in through operational depth

The more Roomflow becomes the system of record for lead intake and qualification, the harder it is to replace.

## 2.5 Support future monetization

Advanced integrations can power premium plans, setup services, partner channels, and enterprise features.

---

# 3. Integration categories

Roomflow should treat integrations as structured categories, not a random list.

## 3.1 Lead source integrations

Used to ingest prospects and listing responses.

Examples:

* Zillow Rental Network feeds / contacts
* Apartments.com feed / lead channels
* Meta Lead Ads
* listing portal email leads
* web forms
* CSV imports
* API/webhook imports

## 3.2 Messaging integrations

Used for two-way communication with leads.

Examples:

* email
* SMS
* WhatsApp
* Instagram messaging
* future voice/transcription providers

## 3.3 Calendar integrations

Used for tour scheduling and operator coordination.

Examples:

* Google Calendar
* Microsoft Outlook / Microsoft 365 Calendar
* iCal export / import

## 3.4 Screening integrations

Used to launch and track tenant screening workflows.

Examples:

* tenant screening providers
* background check providers
* identity verification providers

## 3.5 Listing distribution integrations

Used to publish listing data or sync availability to marketplaces and rental portals.

Examples:

* Zillow rentals feed
* Apartments.com feed
* MLS / RESO data flows where applicable
* third-party syndication platforms

## 3.6 CRM / workflow integrations

Used to move lead events into external business systems.

Examples:

* webhook destinations
* Zapier / Make / n8n
* Slack
* CRM exports

## 3.7 Document and file integrations

Used for attachments, screening files, listing assets, and exports.

Examples:

* S3-compatible object storage
* Google Drive (later)
* Dropbox / Box (later)

## 3.8 Analytics and attribution integrations

Used to track source performance and campaign flow.

Examples:

* UTM ingestion
* ad source metadata
* conversion webhooks

---

# 4. Integration operating model

Every integration should fit one of four implementation patterns.

## 4.1 Native API integration

Roomflow talks directly to a provider API.

Examples:

* Twilio SMS
* Google Calendar
* Microsoft Graph
* Meta Lead Ads

## 4.2 Hosted partner integration

A provider controls a hosted workflow and Roomflow syncs status.

Examples:

* hosted screening invitation flow
* hosted consent / disclosure flow

## 4.3 Feed / file integration

Roomflow imports or exports structured files or feed-based data.

Examples:

* Zillow Rentals feed
* Apartments.com feed
* CSV import/export
* listing syndication payloads

## 4.4 Inbound parsing integration

Roomflow uses inboxes, webhooks, forwarding, or scraping-safe public channels to interpret leads without a formal API.

Examples:

* listing portal email leads
* forwarded inquiry mailboxes
* manual copy/paste import

---

# 5. Integration design principles

## 5.1 Roomflow is the source of workflow truth

External systems can originate or consume data, but Roomflow owns:

* lead identity
* lead status
* qualification state
* house-rule fit state
* activity timeline

## 5.2 Preserve external provenance

Every imported field must retain source context.

## 5.3 Use adapters, not provider logic scattered across the app

Each provider should be implemented behind a provider adapter interface.

## 5.4 Graceful fallback matters

If a direct integration does not exist, Roomflow should still support manual import or email ingestion.

## 5.5 Compliance-sensitive integrations must be sandboxed

Screening and records integrations should be isolated behind stricter permissions, audit trails, and explicit operator actions.

---

# 6. Priority integration targets

This section defines the recommended target list.

---

## 6.1 Tier 1 — mandatory integrations

These are the integrations that give the strongest room-rental workflow value earliest.

### 6.1.1 Email provider

Purpose:

* send transactional email
* receive inbound replies
* thread inquiry conversations
* trigger workflow updates on replies

Recommended providers:

* Resend
* Postmark (future option)
* Amazon SES (future option)

Recommended v1:

* Resend for outbound first
* inbound email parsing via webhook or forwarding path

Core capabilities:

* outbound send
* send logs
* bounce tracking
* delivery tracking
* reply threading
* alias or property mailbox routing

---

### 6.1.2 SMS provider

Purpose:

* fast follow-up
* two-way qualification messaging
* reminders
* tour confirmations

Recommended providers:

* Twilio SMS
* Telnyx (future option)

Recommended v1:

* Twilio SMS

Core capabilities:

* two-way SMS
* opt-out tracking
* per-property sender config
* automation throttles
* message status events

---

### 6.1.3 Calendar provider

Purpose:

* schedule tours
* sync showing events
* prevent double-booking
* support reminders

Recommended providers:

* Google Calendar
* Microsoft Outlook / Microsoft 365 Calendar

Recommended v1:

* Google Calendar first
* Outlook second

Core capabilities:

* create events
* update / cancel events
* push notifications / webhook handling
* event sync state tracking

---

### 6.1.4 Lead ingestion by email / webhook / form

Purpose:

* ensure Roomflow can ingest leads even when portal APIs are limited

Methods:

* dedicated inbound email addresses
* web form endpoints
* generic webhook endpoints
* CSV import
* manual quick-add

Core capabilities:

* create lead
* dedupe suggestion
* source tagging
* parse lead payload
* attach message body and metadata

---

## 6.2 Tier 2 — strong growth integrations

These materially increase lead coverage and operator value.

### 6.2.1 Meta Lead Ads

Purpose:

* ingest leads from Facebook / Instagram ad campaigns
* capture source metadata
* accelerate paid acquisition workflows

Capabilities:

* webhook subscription
* lead retrieval
* form mapping
* campaign attribution
* ad/account/page mapping

Use cases:

* room-rental campaigns
* waitlist capture
* move-in campaigns
* promoted listings

---

### 6.2.2 Instagram messaging

Purpose:

* support business messaging conversations from Instagram

Capabilities:

* inbound message sync
* outbound replies
* thread association to lead
* operator inbox support

---

### 6.2.3 WhatsApp

Purpose:

* two-way prospect messaging on a widely used channel

Capabilities:

* inbound / outbound messaging
* template messaging support where required
* conversation threading
* opt-in / compliance handling

Recommended provider:

* Twilio Conversations / WhatsApp

---

### 6.2.4 Zillow rentals feed / contact ingestion

Purpose:

* sync listing data or ingest rental leads from the Zillow ecosystem

Capabilities:

* listing feed export or sync
* listing metadata mapping
* source attribution
* contact ingestion if supported by partner path

Recommended approach:

* support feed-based syndication and ingestion model
* build provider adapter, but expect access and onboarding to be provider-controlled

---

### 6.2.5 Apartments.com feed / partner path

Purpose:

* publish listing updates and keep data current on the Apartments.com network

Capabilities:

* feed setup metadata
* unit / room mapping
* photos and amenities mapping
* availability sync
* inquiry routing support where available

Recommended approach:

* support provider feed/export structure
* maintain source mappings and import fallbacks

---

## 6.3 Tier 3 — advanced workflow integrations

These are strong premium or enterprise integrations.

### 6.3.1 Screening provider integration

Purpose:

* launch tenant screening or background check workflow
* track screening status
* attach reports or report summaries
* preserve audit history

Recommended providers:

* CIC
* RentPrep Enterprise
* Checkr (carefully scoped)

Recommended approach:

* hosted workflow initiation
* webhook-based status sync
* explicit consent and disclosure capture via provider
* no Roomflow-generated screening score

---

### 6.3.2 Public records / compliance-sensitive data partner

Purpose:

* support workflow visibility where permitted through a screening partner

Recommended approach:

* only through approved screening providers or regulated partners
* no DIY public-records aggregation in v1

---

### 6.3.3 MLS / RESO / broker feed support

Purpose:

* support data exchange with real estate systems where room or rental inventory is connected to broker/MLS workflows

Recommended approach:

* build a generic RESO-compatible import/export layer
* partner-specific onboarding required
* mostly enterprise / partner motion

---

### 6.3.4 Workflow automation endpoints

Purpose:

* connect Roomflow events to external automation tools

Targets:

* Zapier
* Make
* n8n
* Slack
* custom webhooks

Capabilities:

* lead created event
* lead status changed event
* qualified event
* tour scheduled event
* screening requested event

---

# 7. Canonical provider matrix

This matrix defines the likely provider strategy.

## Messaging

* Email: Resend
* SMS: Twilio
* WhatsApp: Twilio Conversations / WhatsApp
* Instagram Messaging: Meta

## Calendars

* Google Calendar
* Microsoft Graph Calendar
* iCal feed export (later)

## Lead Ads / Social Acquisition

* Meta Lead Ads
* Instagram messaging
* future landing-page form integrations

## Listing Distribution / Feeds

* Zillow Rentals feed
* Apartments.com feed
* generic feed export layer
* generic import via CSV / email / webhooks

## Screening

* CIC
* RentPrep Enterprise
* Checkr

## Automation / Events

* first-party webhooks
* Zapier / Make / n8n
* Slack

---

# 8. Integration feature surfaces in the product

Integrations should be visible as a major app feature.

## 8.1 Settings > Integrations hub

This is the main index of all connected systems.

Sections:

* Connected channels
* Listing feeds
* Screening providers
* Calendars
* Automation destinations
* Import / export tools

## 8.2 Property-level channel settings

Each property should be able to define:

* allowed channels
* preferred outbound channel
* sender identity
* calendar target
* listing feed mapping

## 8.3 Source management page

Operators should be able to view:

* all known lead sources
* whether source is native, feed, email, or manual
* last successful sync
* source-specific settings

## 8.4 Screening center

A separate area for compliance-sensitive integrations:

* provider configuration
* package selection
* launch screening action
* screening timeline
* result status
* audit history

## 8.5 Developer / automation page

Advanced customers should be able to:

* create API keys
* configure outbound webhooks
* inspect event deliveries
* retry failed deliveries

---

# 9. Detailed integration specs by category

---

## 9.1 Email integration spec

### Objectives

* send outbound workflow email
* receive replies
* map email thread to lead
* support aliases per property or workspace

### Core objects

* EmailChannel
* EmailThread
* EmailMessage
* EmailDeliveryEvent

### Required capabilities

* send email
* send template email
* receive inbound replies
* parse subject/body/from/to
* capture attachments metadata
* detect threading headers if available
* log delivery / bounce / complaint events

### Configuration

* provider
* verified domain
* sender email
* reply-to strategy
* routing alias pattern
* webhook secret

### Failure handling

* bounce -> flag channel issue
* complaint -> suppress outbound automation
* threading failure -> require manual lead assignment

---

## 9.2 SMS / WhatsApp integration spec

### Objectives

* support high-speed conversation workflows
* handle opt-in / opt-out rules
* support reminders and quick replies

### Core objects

* SmsChannel
* Conversation
* Message
* DeliveryReceipt
* OptOutState

### Required capabilities

* send message
* receive message
* track delivery state
* track STOP / opt-out keywords
* route inbound message to lead
* assign number to workspace or property

### Configuration

* provider account credentials
* sender number / sender pool
* compliance registration state
* default message policy
* quiet hours / rate limit policy

### Failure handling

* failed delivery
* blocked sender
* unregistered campaign state
* opt-out suppression

---

## 9.3 Calendar integration spec

### Objectives

* sync tours to operator calendars
* receive updates when events change externally
* prevent stale schedule state

### Core objects

* CalendarAccount
* CalendarConnection
* CalendarEvent
* EventSyncState
* AvailabilityWindow

### Required capabilities

* create event
* update event
* cancel event
* receive change notifications or poll fallback
* map Roomflow event ID to provider event ID

### Configuration

* provider
* OAuth credentials
* calendar target ID
* default event duration
* reminder policy
* conflict detection settings

### Failure handling

* expired OAuth token
* webhook subscription expiration
* event update conflict
* duplicate event creation

---

## 9.4 Lead Ads and social messaging spec

### Objectives

* ingest ad-originated leads in real time
* preserve campaign/source attribution
* support social messaging threads in one inbox

### Core objects

* LeadSourceConnection
* SocialThread
* CampaignAttribution
* LeadCaptureFormMap

### Required capabilities

* subscribe to lead webhooks
* retrieve lead data payload
* map platform fields to Roomflow lead schema
* attach page / campaign metadata
* create or match lead
* support message thread association if social messaging is connected

### Configuration

* platform account
* page / account mapping
* form mapping
* default property assignment
* source tags

### Failure handling

* invalid token
* expired permission
* webhook verification failure
* field mapping mismatch

---

## 9.5 Listing feed integration spec

### Objectives

* publish or update listing data externally
* keep room or property availability synchronized
* preserve source attribution for inquiries

### Core objects

* ListingDistributionConnection
* ListingFeedProfile
* ListingExternalRecord
* ListingSyncJob
* ListingMediaAsset

### Required capabilities

* map property fields to provider feed fields
* sync pricing and availability
* sync images / amenities / description
* track listing publication status
* reconcile external listing identifiers

### Configuration

* provider
* credentials / partner approval state
* feed profile
* per-property publish toggle
* field mapping profile

### Failure handling

* provider validation error
* rejected listing payload
* missing required field
* media sync failure
* out-of-date feed state

---

## 9.6 Screening integration spec

### Objectives

* launch provider-native screening workflow
* track status changes
* record audit trail
* prevent Roomflow from becoming the screening decision engine

### Core objects

* ScreeningProviderConnection
* ScreeningRequest
* ScreeningPackage
* ScreeningConsentRecord
* ScreeningStatusEvent
* ScreeningAttachmentReference

### Required capabilities

* create candidate / applicant record if needed
* initiate hosted invitation flow
* receive webhook updates
* store provider report references and status
* trigger operator notification when completed

### Configuration

* provider credentials
* package mapping
* applicant pay / landlord pay mode
* allowed launch roles
* disclosure text handling strategy

### Failure handling

* provider credential not approved
* invitation expired
* report incomplete
* webhook failure
* adverse action follow-up missing

---

## 9.7 Automation / webhook integration spec

### Objectives

* let customers export workflow events to other tools
* power no-code automations
* support partner integrations without first-party UI work

### Core objects

* WebhookEndpoint
* WebhookSubscription
* EventDelivery
* DeliveryRetry

### Supported events

* lead.created
* lead.updated
* lead.status_changed
* lead.qualified
* lead.caution
* lead.mismatch
* lead.declined
* tour.scheduled
* tour.canceled
* screening.requested
* screening.completed
* message.received
* message.sent

### Required capabilities

* signed payloads
* retry queue
* dead-letter logging
* event replay
* test send

---

# 10. Data model additions

The integrations platform requires explicit schema support.

## 10.1 Core tables / collections

* integration_providers
* workspace_integrations
* property_integrations
* external_accounts
* external_objects
* sync_jobs
* sync_job_errors
* inbound_events
* outbound_events
* webhook_endpoints
* webhook_deliveries
* channel_identities
* message_channels
* screening_requests
* screening_status_events
* calendar_connections
* listing_connections
* source_connections

## 10.2 External object pattern

Every external object should support:

* provider_name
* external_id
* external_type
* workspace_id
* property_id nullable
* roomflow_object_type
* roomflow_object_id
* sync_state
* last_synced_at
* raw_payload_snapshot optional

---

# 11. Integration state model

Each integration should have clear states.

## 11.1 Common states

* `not_connected`
* `pending_setup`
* `connected`
* `degraded`
* `disconnected`
* `error`
* `partner_review_required`

## 11.2 Sync job states

* `queued`
* `running`
* `succeeded`
* `partially_succeeded`
* `failed`
* `retrying`

---

# 12. Security and permissions

## 12.1 Role-based permissions

Only authorized roles should be able to:

* connect integrations
* view secrets
* launch screenings
* change channel settings
* export data
* configure webhooks

## 12.2 Secret management

Store provider credentials securely.
Never expose raw secrets after initial connection.

## 12.3 Audit logging

Every integration action should be logged:

* connected
* disconnected
* token refreshed
* sync failed
* webhook retried
* screening launched
* external record merged

---

# 13. Compliance boundaries

## 13.1 Messaging compliance

* SMS opt-out handling
* sender registration handling
* quiet hours and rate limiting

## 13.2 Screening compliance

* provider-hosted consent preferred
* no hidden scoring from Roomflow
* strict audit trail

## 13.3 Fair-housing-sensitive workflows

* avoid social-media-based scoring
* avoid protected-trait inference
* avoid automated denials by AI default

## 13.4 Partner-gated ecosystems

Some channels may require partner or provider approval.
The product must support this with `partner_review_required` states and setup instructions.

---

# 14. UX and onboarding flows

## 14.1 Integration marketplace page

A card-based page showing:

* provider name
* category
* status
* setup complexity
* self-serve vs partner-gated

## 14.2 Setup wizard

Each integration gets a guided flow:

1. explanation
2. prerequisites
3. auth / credential entry
4. mapping
5. test event
6. completion state

## 14.3 Health center

Operators should see:

* failed syncs
* expiring tokens
* disconnected channels
* screening provider issues
* webhook retry counts

---

# 15. Build order

## Phase 1

* Resend outbound email
* Twilio SMS
* Google Calendar
* generic inbound email / webhook / CSV import
* internal integration framework

## Phase 2

* Meta Lead Ads
* Instagram messaging
* WhatsApp
* first-party webhooks
* integration health center

## Phase 3

* Zillow rentals feed path
* Apartments.com feed path
* Outlook calendar
* screening provider integration (one provider)

## Phase 4

* generic syndication/export framework
* Zapier / Make / n8n connectors
* MLS / RESO enterprise path
* advanced screening and compliance features

---

# 16. Recommended first-party integration roadmap

If Roomflow wants to make integrations a major feature add, the strongest roadmap is:

## Core comms and scheduling

1. Email
2. SMS
3. Google Calendar
4. Inbound lead ingestion

## Acquisition and social

5. Meta Lead Ads
6. Instagram messaging
7. WhatsApp

## Distribution and syndication

8. Zillow rentals feed
9. Apartments.com feed
10. generic listing feed/export model

## Compliance-sensitive and premium

11. Screening provider
12. Outlook calendar
13. Automation / webhook platform
14. MLS / RESO enterprise connectors

---

# 17. Positioning this as a major product feature

This should not be marketed as “integrations available.”
It should be positioned as:

**Roomflow Connect**

Suggested positioning:

* one inbox across rental lead channels
* one lead record across every source
* one workflow from inquiry to screening to tour
* one integrations platform for room-rental operations

---

# 18. Packaging and monetization

## Base plan

* basic email
* manual imports
* limited web forms

## Growth plan

* SMS
* Google Calendar
* Meta Lead Ads
* webhook exports

## Pro plan

* WhatsApp
* advanced listing feeds
* provider integrations
* workflow automation
* premium sync monitoring

## Enterprise / partner plan

* MLS / RESO onboarding
* custom feed mappings
* partner-gated listing networks
* dedicated screening integrations
* SSO / advanced audit requirements

---

# 19. Success metrics

## Product metrics

* connected integrations per workspace
* active channel usage
* inbound leads by source type
* sync success rate
* webhook delivery success rate
* message reply rate by channel

## Business metrics

* percent of workspaces with 2+ integrations
* plan upgrade rate due to integrations
* retention impact of connected channels
* feed-based listing adoption

## Workflow metrics

* time to first response
* lead capture completeness
* inquiry-to-tour conversion
* reduced manual lead entry

---

# 20. Summary

The integrations platform should make Roomflow the system that sits in the middle of the room-rental operating stack.

That means supporting:

* messaging
* calendars
* lead sources
* listing distribution
* screening
* automation
* imports and exports

The product should be designed so that even when direct APIs are limited, Roomflow still wins by supporting fallback ingestion, feed sync, and workflow normalization.

This makes integrations not just a technical convenience, but one of the strongest strategic product features in the entire platform.
