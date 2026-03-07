# Roomflow — Legal and Compliance Operating Specification

## Purpose

This document is the legal and compliance operating specification for Roomflow.

Its purpose is to define the product, company, data, and operational controls needed to reduce regulatory exposure and lower the likelihood of legal disputes.

This document is written as an internal operating standard.
It is not a substitute for outside counsel.
It is designed to help the company:

* stay inside a safer product posture
* avoid drifting into regulated business models by accident
* operationalize privacy, housing, communications, and screening compliance
* make safer product decisions before launch and as the platform expands

---

# 1. Core legal posture

## 1.1 What Roomflow is

Roomflow is an AI-powered workflow platform for room-rental and shared-housing lead intake, communications, qualification, scheduling, and third-party screening orchestration.

## 1.2 What Roomflow is not

Roomflow is not:

* a tenant screening company
* a consumer reporting agency
* a real estate broker or referral brokerage
* a marketplace selling prospect or tenant data
* a black-box AI housing-decision engine
* a background-check database operator

## 1.3 Prime directive

The product must be designed so that:

* AI assists workflow and communication
* humans remain responsible for consequential decisions
* third-party screening providers handle regulated screening functions
* the company does not create hidden eligibility or risk scoring for housing decisions

## 1.4 Company legal strategy

The company should optimize for:

* low-capex compliance discipline
* U.S.-first launch scope
* processor-style SaaS behavior where possible
* minimal retention of the most sensitive categories of data
* clear auditability
* strong vendor management

---

# 2. Product red lines

The following features or behaviors are prohibited by default unless outside counsel explicitly approves a later product version and the company is prepared to absorb the regulatory burden.

## 2.1 Prohibited default behaviors

* auto-denying applicants based on AI output
* assigning tenant risk scores
* hidden applicant ranking for housing eligibility
* inferring protected traits from communications or profiles
* scraping social media for screening decisions
* building an internal criminal/public-record screening engine
* selling or licensing lead data to third parties
* paying or collecting referral fees in ways that may require real-estate broker licensing
* storing unnecessary full screening reports when metadata or report references are sufficient
* processing screening data without explicit workflow gating and consent evidence

## 2.2 Restricted features requiring legal review

These features are not permanently banned, but require formal legal review, product approval, and operational controls before launch:

* finder’s fee programs
* prospect referral marketplaces
* social-profile enrichment for housing use
* applicant ranking features
* any “accept / deny” recommendation engine
* direct public-record ingestion beyond an approved screening partner
* international expansion beyond the U.S.
* automated adverse-action workflows that operate without human review

---

# 3. Regulatory domains that govern Roomflow

Roomflow touches multiple overlapping legal areas.
The company must treat compliance as a set of workstreams rather than one generic privacy policy.

## 3.1 Housing and anti-discrimination law

Covers fair-housing restrictions, discriminatory advertising, tenant screening, and AI use in housing decisions.

## 3.2 Consumer reporting and screening law

Covers tenant screening, adverse action, permissible purpose, and consumer report handling.

## 3.3 Communications law

Covers SMS, calls, robocalls, opt-outs, email marketing, and formal messaging.

## 3.4 Privacy and data security law

Covers breach notification, reasonable security, privacy notices, rights requests, data minimization, and vendor handling.

## 3.5 International data law

Covers GDPR, EEA/UK transfers, lawful basis, processor terms, and retention.

## 3.6 Licensing/intermediary law

Covers whether referrals, placement fees, or related services may require broker licensing or other state-specific permissions.

## 3.7 Tax and commercial law

Covers SaaS taxation, nexus, contracts, disclaimers, and liability allocation.

---

# 4. Compliance architecture by role

## 4.1 Product

Responsible for defining what features exist and what is blocked by default.

## 4.2 Engineering

Responsible for enforcement controls, data handling, audit logs, security, retention, and deletion.

## 4.3 Operations

Responsible for vendor onboarding, incident response, subprocessor inventory, and policy execution.

## 4.4 Leadership

Responsible for launch gates, legal review triggers, and decisions on high-risk expansions.

## 4.5 Outside counsel

Responsible for product review in high-risk areas, state-specific referral/licensing questions, privacy program review, and contract review.

---

# 5. Federal baseline controls

This section defines the default federal compliance posture the company must adopt before launch.

## 5.1 Fair housing and AI in housing

### Rules to adopt

* Roomflow must not automate final housing decisions by default.
* Roomflow must not present AI outputs as definitive legal eligibility results.
* Any fit, caution, or mismatch output must be framed as workflow guidance tied to explicit property rules.
* The system must preserve reasons and evidence for any recommendation shown to an operator.
* The system must never infer or surface protected traits.

### Product controls

* require human review for declines by default
* require visible rule-based explanation for mismatch/caution outputs
* prohibit hidden scoring
* maintain an audit log for overrides and declines

## 5.2 Screening and consumer reporting

### Rules to adopt

* Screening must be provider-hosted where possible.
* Roomflow should launch screening, track status, and store references, not assemble reports itself.
* Roomflow must not market itself as a screening company unless the business intentionally enters that category.
* Adverse-action workflows must remain customer-controlled and documented.

### Product controls

* screening launch center only through approved provider adapters
* consent state required before advancing screening workflow state
* operator permissions required for screening launch
* screening attachments minimized and access-restricted
* report references and timestamps preferred over bulk raw report retention

## 5.3 Communications law baseline

### Rules to adopt

* SMS consent must be captured by channel and purpose.
* Opt-outs must be honored immediately in product behavior.
* Quiet hours and throttles must exist for automated messaging.
* Email marketing and transactional email must be distinguishable.
* Commercial emails must support unsubscribe and required footer content.

### Product controls

* per-channel consent table
* STOP/opt-out suppression logic
* quiet hours setting
* template categories: transactional, workflow, promotional
* no automated outreach when consent state is missing or revoked

---

# 6. 50-state compliance framework

Roomflow should not try to memorize isolated statutes in product logic.
Instead, the company should maintain a 50-state issue matrix and build the product so stricter state requirements can be honored through policy, configuration, and workflow controls.

## 6.1 State-law workstreams that matter most

Every state can affect the business through one or more of these issue categories:

* breach notification
* reasonable security
* telemarketing/texting restrictions
* privacy rights / omnibus privacy law
* data broker / sale / online privacy rules
* real-estate referral or broker-licensing rules
* landlord-tenant or screening related state rules
* accessibility / unfair trade practice / deceptive policy enforcement
* taxability and nexus

## 6.2 The company’s state-by-state policy model

Maintain a legal matrix for all 50 states with these columns:

* state
* comprehensive privacy law applicable? yes/no
* breach law requirements
* reasonable security requirement level
* state texting/telemarketing sensitivity level
* online privacy / sale opt-out / data broker relevance
* referral or broker-fee caution level
* housing/screening sensitivity notes
* tax and nexus monitoring flag
* internal owner
* last reviewed date

## 6.3 State categories for product design

### Category A — all states baseline

Every state is treated as having:

* breach-notification exposure
* data-security obligations at some level
* consumer-protection/deceptive-practices exposure

### Category B — comprehensive privacy states

Build the platform so it can satisfy privacy-rights and notice obligations in states with omnibus privacy laws.

### Category C — mini-TCPA / stricter telemarketing states

Treat texting and outbound automated contact rules conservatively enough to survive stricter states.

### Category D — referral/licensing risk states

Treat any finder’s-fee or referral feature as prohibited by default until state-specific review is done.

---

# 7. U.S. privacy and security operating standard

## 7.1 Privacy-by-default controls

The platform must implement:

* data minimization
* purpose limitation
* role-based access control
* least privilege
* audit logging for sensitive actions
* deletion and retention controls
* export capability for account-level data rights
* secure defaults for attachments and external links

## 7.2 Consumer rights readiness

Even if not every law applies immediately, the platform should be able to support:

* access request handling
* deletion request handling
* correction request handling
* export/portability handling where appropriate
* opt-out of marketing communications
* opt-out of sale/sharing if that model is ever introduced

## 7.3 Security baseline

Engineering must implement and maintain:

* TLS in transit
* encryption at rest for database/storage where feasible
* secure secret management
* session revocation
* access logging
* environment separation
* dependency patching process
* least-privilege infrastructure access
* backup retention controls

## 7.4 Incident response

The company must maintain:

* incident response playbook
* severity classification
* decision tree for breach analysis
* customer communication templates
* regulator notification checklist
* vendor escalation contacts
* log preservation process
* post-incident remediation tracking

---

# 8. Comprehensive privacy states program

Because multiple states now have omnibus privacy laws, Roomflow should adopt a privacy program that can scale to those regimes without needing a redesign.

## 8.1 Baseline privacy-program requirements

* privacy notice
* subprocessor inventory
* vendor/processor agreements
* intake path for consumer rights requests
* internal data map by category and purpose
* retention schedule
* deletion procedure
* sensitive-data handling controls
* internal privacy owner

## 8.2 Sensitive-data posture

Sensitive data should be flagged internally and treated with stricter controls.
Examples include:

* government identifiers
* financial screening data
* precise geolocation if collected
* credentials
* criminal-history-related screening references
* any documents uploaded for screening or identity verification

## 8.3 Sale / sharing / data-broker posture

The company should default to:

* no sale of personal data
* no third-party data-broker business model
* no reselling prospect information
* no hidden monetization of tenant/lead data

If this ever changes, the business model requires a separate legal review and likely a different privacy program.

---

# 9. GDPR / EEA / UK privacy posture

## 9.1 Launch recommendation

The company should launch U.S.-first and avoid intentional EEA/UK targeting until the GDPR/UK GDPR program is ready.

## 9.2 If EU/EEA/UK data is processed

The company must be prepared to support:

* lawful basis mapping
* controller/processor role mapping
* processor terms
* subprocessor disclosures
* data subject rights handling
* retention/deletion by purpose
* transfer mechanisms
* security measures
* breach response timing requirements

## 9.3 Controller vs processor stance

### Roomflow as processor

For customer prospect and operator-uploaded lead data, the preferred position is usually processor/service provider to the customer controller, where factually supportable.

### Roomflow as controller

For account signup, billing, security logs, product analytics, and direct marketing, Roomflow is likely controller.

## 9.4 Cross-border transfer posture

If EEA/UK data is moved to the U.S. or other non-adequate jurisdictions, the company must use an approved transfer mechanism through its vendors and contracts.

## 9.5 Criminal/offence data under GDPR

The platform should avoid becoming a repository of raw criminal-offence data unless there is a well-supported legal basis and a compelling operational need.
Provider-hosted and reference-based models are safer.

---

# 10. Data retention and deletion standard

## 10.1 Retention philosophy

Data must be retained only as long as needed for the purpose for which it was collected, operational review, security, dispute resolution, contractual obligations, or legal hold.

## 10.2 Data categories and default posture

### Account and subscription records

Retain while account is active and for a defined post-termination business/legal period.

### Lead records

Retain while active and for a limited post-inactivity/archive period, then delete or anonymize according to customer/workspace policy where feasible.

### Message content

Retain for operational workflow and customer support needs, then archive or delete based on policy.

### Screening data

Prefer metadata, status, timestamps, package selection, and report references over full raw report storage.
If full documents are stored, restrict access and set shorter retention by default.

### AI artifacts

Store only what is operationally necessary.
Apply retention rules to generated summaries, drafts, and extraction artifacts.

### Audit logs

Retain longer than ordinary workflow content because they support security and dispute handling.

### Security logs

Retain according to incident response and operational needs.

## 10.3 Product requirements for retention

The platform must support:

* retention categories
* retention schedules by category
* delete/anonymize jobs
* legal-hold override capability
* customer/workspace export prior to deletion where relevant
* deletion audit logs

---

# 11. Messaging compliance program

## 11.1 Consent model

Consent must be tracked separately for:

* email transactional
* email marketing
* SMS transactional/workflow
* SMS marketing
* WhatsApp if added

Each consent record should include:

* who consented
* channel
* purpose
* timestamp
* method of capture
* evidence snapshot/reference
* scope
* revocation state

## 11.2 Opt-out model

The platform must:

* support STOP-style suppression for SMS
* support unsubscribe for email where applicable
* mark revocation immediately in internal state
* stop automated sends to revoked channels
* preserve audit evidence of revocation

## 11.3 Message categories

Every template/message must be typed as:

* transactional
* workflow/informational
* marketing/promotional
* internal note

This type controls allowable send logic, footer requirements, consent requirements, and suppression handling.

## 11.4 Quiet hours and throttling

The platform must support:

* quiet hours by workspace or recipient time zone policy
* max automated messages per day/week
* duplicate-template suppression
* escalation to manual review if automation is blocked repeatedly

---

# 12. Screening and verification program

## 12.1 Approved operating model

The approved operating model is:

* operator chooses provider
* provider-hosted invitation/consent flow
* Roomflow receives status updates and limited metadata
* operator reviews results outside or through linked references
* operator takes documented next steps

## 12.2 Data minimization rule

Only collect or store screening data necessary to run the workflow.
Prefer:

* provider ID
* package selected
* invite timestamp
* consent complete status
* report complete status
* operator reviewed status
* adverse action tracked status
* reference URL/identifier

Avoid storing bulk raw reports unless necessary.

## 12.3 Access control

Only authorized roles can:

* launch screening
* view screening state
* access screening attachments/references
* record adverse-action-related workflow steps

## 12.4 Audit requirements

All screening events must be logged:

* launched by whom
* provider
* package
* consent state
* completion state
* review state
* attachment access
* workflow changes after screening

---

# 13. AI legal operating standard

## 13.1 Approved AI uses

AI may be used to:

* extract fields from inquiries
* summarize threads
* detect missing information
* draft messages
* translate messages
* explain rule conflicts
* suggest next best actions
* generate non-binding workflow suggestions

## 13.2 Restricted AI uses

AI must not, by default:

* issue final accept/deny decisions
* rank prospects as a hidden eligibility signal
* infer race, religion, disability, nationality, sexual orientation, or other protected characteristics
* use social or external behavior as covert eligibility scoring
* create fake facts and present them as confirmed

## 13.3 Explainability requirement

Any material AI suggestion shown in workflow should be accompanied by:

* source/evidence where practical
* explicit uncertainty when applicable
* clear indication that the output is advisory, not determinative

## 13.4 Human-review requirement

Require human review before:

* declines based on fit conflicts
* application advancement tied to sensitive states
* screening-triggered downstream decisions if the workflow is configured conservatively

## 13.5 Logging and model governance

Maintain internal records for:

* model/provider used
* prompt/version reference
* output schema version
* generation timestamp
* downstream effect if accepted/applied

---

# 14. Referral, marketplace, and finder’s-fee policy

## 14.1 Default policy

The company will not launch paid tenant-referral or finder’s-fee functionality at initial launch.

## 14.2 Reason

These features can trigger:

* broker-licensing issues
* intermediary/liability issues
* state-specific payment restrictions
* unfair trade practice risk if incentives are poorly disclosed

## 14.3 Allowed low-risk alternatives

Safer alternatives may include:

* neutral partner directory pages
* operator-initiated links to third-party services
* non-commissioned integration marketplace pages
* future referral programs only after state-by-state licensing review

## 14.4 Escalation trigger

If the business wants to charge for prospect introductions, split revenue on placements, or pay users for placement activity, outside counsel review is mandatory before product work begins.

---

# 15. Accessibility and public-site compliance standard

## 15.1 Accessibility target

Public pages, onboarding, prospect portals, and core workflows should be built to a practical accessibility target aligned with modern WCAG AA expectations.

## 15.2 Priority surfaces

* marketing site
* signup/login
* onboarding
* inbox core actions
* lead detail
* invite pages
* scheduling page
* public forms

## 15.3 Accessibility controls

* keyboard navigation
* visible focus states
* semantic form labels
* contrast compliance
* error-message clarity
* accessible modals/dialogs
* accessible tables and status indicators

---

# 16. Contract stack required before launch

The company should have a minimum contract/document set in place before launch.

## 16.1 Customer-facing documents

* Terms of Service
* Privacy Policy
* Acceptable Use Policy
* Messaging consent language
* AI use disclosure language
* prospect/public tool disclaimers where appropriate

## 16.2 B2B/privacy documents

* Data Processing Addendum
* Subprocessor list
* Security overview / security commitments
* support and incident-notification commitments where promised

## 16.3 Internal policies

* incident response plan
* retention and deletion policy
* vendor management policy
* access control policy
* vulnerability/patching policy
* law-enforcement/government request procedure

---

# 17. Vendor and subprocessor program

## 17.1 Approved-vendor principle

No vendor should process customer or prospect data without:

* security review
* contract review
* data category review
* role mapping
* subprocessor inventory update

## 17.2 Required vendor records

For each vendor maintain:

* name
* service category
* data categories involved
* regions involved
* security posture summary
* transfer mechanism if applicable
* agreement date
* owner
* last review date

## 17.3 High-sensitivity vendors

Apply stricter review to vendors handling:

* screening data
* communications
* authentication
* storage
* AI processing
* analytics/session replay

---

# 18. Data transfer and residency posture

## 18.1 Default posture

Use U.S.-based infrastructure initially where practical.
Keep architecture ready for regionalization later.

## 18.2 If international customers are added

The company must be able to document:

* where data is stored
* which vendors access/process it
* transfer mechanism used
* subprocessor list
* retention/deletion behavior

## 18.3 Product requirements

The platform should support:

* export and deletion by workspace
* subprocessor disclosures
* region-aware vendor configuration later if needed

---

# 19. Security and access-control program

## 19.1 Identity and session controls

* strong session invalidation
* device/session list
* optional MFA/passkeys later
* admin revocation of member sessions
* login audit events

## 19.2 Authorization controls

* workspace isolation
* property-level scoping where needed
* role-based enforcement server-side
* no client-only access controls for sensitive actions

## 19.3 File and attachment controls

* signed URLs or equivalent secure access
* short-lived external access links
* access logging for sensitive files
* deletion on retention schedule

## 19.4 Integration secrets

* secret storage outside code
* no credential exposure in logs or standard API responses
* rotation process

---

# 20. Incident response and litigation-readiness standard

## 20.1 Incident severity levels

Define severity categories for:

* auth breach
* data exposure
* provider compromise
* unauthorized screening access
* mass messaging error
* AI policy violation

## 20.2 Litigation-readiness basics

The company should be able to produce:

* audit logs
* consent logs
* screening launch history
* decline/override history
* data deletion logs
* integration event history
* user/role history

## 20.3 Legal hold capability

The platform should support internal legal hold behavior so scheduled deletion can be paused for scoped records when necessary.

---

# 21. Customer and prospect disclosure standards

## 21.1 Product marketing claims

Do not claim:

* guaranteed compliance
* guaranteed fair-housing safety
* guaranteed no-discrimination outcome
* guaranteed legal sufficiency of user screening policies
* guaranteed identity of leads

## 21.2 Safer product claims

Prefer claims like:

* helps structure room-rental workflows
* helps document lead communication and house-rule fit
* supports third-party screening orchestration
* includes controls for consent, auditability, and retention workflows

## 21.3 Public AI tools

Public AI tools should include:

* no legal advice disclaimer
* no fair-housing compliance guarantee language
* warning that generated text should be reviewed before use

---

# 22. Launch gating checklist

Before public launch, all of the following should be complete or explicitly waived by leadership after review.

## 22.1 Legal docs

* terms
* privacy policy
* DPA
* subprocessor list
* messaging consent language
* AI disclosure language

## 22.2 Product controls

* consent tracking
* opt-out suppression
* audit logs for sensitive actions
* role-based access control
* screening permissions and provider-only flow
* retention categories defined
* delete/export tooling at least for admin operations

## 22.3 Security controls

* secrets management
* TLS
* backups
* incident response plan
* logging
* access review

## 22.4 Business controls

* vendor inventory
* legal owner assigned
* privacy/security owner assigned
* support escalation path defined

---

# 23. Ongoing review cadence

## 23.1 Quarterly review

Review:

* vendors
* subprocessors
* privacy notice accuracy
* consent flows
* retention jobs
* feature drift into restricted categories
* state-law matrix updates

## 23.2 Pre-feature review triggers

Require internal legal/product review before building:

* any new screening capability
* any referral/commission feature
* any AI that ranks or classifies applicants in a material way
* any new international launch
* any data sale/sharing/monetization model
* any biometric or voiceprint feature

## 23.3 Annual external review

At least annually, outside counsel or specialist review should examine:

* terms/privacy/DPA
* state privacy applicability
* communications compliance posture
* housing/screening product boundaries
* referral/licensing risk if product scope changes

---

# 24. 50-state operating matrix template

The company should maintain an internal matrix for every U.S. state using this structure.

For each state track:

* state
* breach-notification baseline
* comprehensive privacy law? yes/no
* sensitive-data or minors data notes
* texting/telemarketing caution level
* online privacy/data-broker caution level
* real-estate referral/licensing caution level
* special housing/screening notes
* sales-tax/nexus monitoring status
* owner
* reviewed on
* next review due

States to include:

* Alabama
* Alaska
* Arizona
* Arkansas
* California
* Colorado
* Connecticut
* Delaware
* Florida
* Georgia
* Hawaii
* Idaho
* Illinois
* Indiana
* Iowa
* Kansas
* Kentucky
* Louisiana
* Maine
* Maryland
* Massachusetts
* Michigan
* Minnesota
* Mississippi
* Missouri
* Montana
* Nebraska
* Nevada
* New Hampshire
* New Jersey
* New Mexico
* New York
* North Carolina
* North Dakota
* Ohio
* Oklahoma
* Oregon
* Pennsylvania
* Rhode Island
* South Carolina
* South Dakota
* Tennessee
* Texas
* Utah
* Vermont
* Virginia
* Washington
* West Virginia
* Wisconsin
* Wyoming

The matrix is a governance artifact and must be updated as the business changes.

---

# 25. Recommended legal launch posture for Roomflow

## 25.1 Launch scope

* U.S.-only marketing initially
* no direct EU targeting until privacy program is ready
* no in-house screening reports
* no referral fees
* no social-media screening
* no auto-deny AI

## 25.2 Safer initial product promise

Roomflow helps operators organize inquiries, communicate with prospects, gather missing information, document house-rule fit, and coordinate next steps.

## 25.3 Safer initial data posture

* minimize sensitive data storage
* store references rather than raw screening reports where possible
* support deletion and retention controls
* maintain audit logs and consent records

---

# 26. Final rule

The company should behave as though every new feature can change its legal category.

Before launching any feature that touches:

* screening
* ranking
* referrals/commissions
* data monetization
* international data
* biometrics
* public records
* automated denials

assume legal review is required.

The safest long-term strategy is not trying to eliminate all legal risk.
The safest long-term strategy is:

* knowing what category the business is in
* refusing to drift into higher-risk categories by accident
* building operational controls that prove what the product did and did not do
* maintaining documentation, auditability, and vendor discipline from the beginning
