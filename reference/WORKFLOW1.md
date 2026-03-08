Below is the **deep operational specification for Workflow 1: Sign Up & Create Workspace**.
This is written as a **product + UX + security + engineering behavior spec**, because this workflow determines first impressions, conversion, and long-term account structure.

---

# Workflow 1 — Sign Up and Create Workspace

## Purpose

This workflow converts a **visitor → authenticated user → initialized workspace**.

It must:

* be extremely low friction
* establish the **workspace isolation model**
* capture only **minimum required identity**
* establish **authentication + session**
* create a **workspace container**
* route the user into onboarding

This workflow should take **under 60 seconds** for a motivated user.

---

# Workflow goals

Primary goals:

1. convert visitor to authenticated user
2. create the user identity
3. create the workspace container
4. determine plan tier
5. route into onboarding

Secondary goals:

* preserve attribution data
* store consent records
* establish audit trail
* detect duplicate accounts
* prevent abuse

---

# Entry points into workflow

A user may start signup from multiple places.

### Entry point sources

* homepage CTA
* pricing page
* AI tool conversion
* demo CTA
* invite link (org)
* direct signup page
* referral link
* deep link from marketing campaign

### URL patterns

Examples:

```
/signup
/signup?plan=personal
/signup?plan=org
/signup?source=ai-tool
/signup?utm_campaign=x
/signup?invite=workspace_token
```

### Pre-fill behaviors

If query parameters exist:

| parameter | behavior                |
| --------- | ----------------------- |
| plan      | preselect pricing tier  |
| invite    | skip workspace creation |
| utm       | preserve attribution    |
| source    | analytics tag           |

---

# Signup options

Users should have **multiple signup methods**.

## Supported authentication methods

### 1. Email + password

Classic signup flow.

User inputs:

```
Email
Password
Confirm password
```

Password rules:

* minimum 10 characters
* require 2 of:

  * uppercase
  * lowercase
  * number
  * symbol

Do NOT require overly complex rules.

---

### 2. Magic link

User inputs:

```
Email
```

System sends login link.

Advantages:

* frictionless
* mobile friendly
* avoids password resets

---

### 3. Google login

OAuth.

User clicks:

```
Continue with Google
```

System retrieves:

```
email
name
profile photo
```

---

### 4. Meta login (later)

Optional.

Not necessary for MVP.

---

# DOs for signup options

DO:

* offer **at least 2 methods**
* allow **Google + email**
* show **privacy assurance text**
* show **simple explanation**

Example:

```
Create your account

Continue with Google
or
Sign up with email
```

---

# DON’Ts for signup

DON'T:

* ask for phone number immediately
* ask for address
* ask for property info
* ask for company name
* ask for many fields
* ask for credit card before value
* force password if magic link exists

Signup must be **minimal friction**.

---

# Signup UI layout

## Page layout

Top:

```
Roomflow logo
```

Center card:

```
Create your account
```

Form:

```
Continue with Google
or
Email
Password
Confirm Password
```

Below:

```
Create account button
```

Footer:

```
Already have an account? Log in
Terms
Privacy
```

---

# UI interaction behavior

### User types email

System:

* validate format
* show inline error if invalid

Example error:

```
Please enter a valid email
```

---

### User types password

System shows:

```
Password strength indicator
```

Example:

```
Weak
Okay
Strong
```

---

### Submit action

User clicks:

```
Create account
```

System behavior:

1. validate inputs
2. create user record
3. create session
4. route to workspace creation

---

# Account creation backend behavior

When signup succeeds:

Create:

```
User
Workspace
WorkspaceMembership
Subscription
AuditLog
```

---

### User object

Fields:

```
id
email
name
auth_provider
password_hash
created_at
verified_at
```

---

### Workspace object

Fields:

```
id
name
plan
owner_user_id
created_at
```

Default name:

```
<user first name>'s Workspace
```

Example:

```
Earl's Workspace
```

---

### Workspace membership

Fields:

```
workspace_id
user_id
role
```

Role:

```
owner
```

---

### Subscription

Default:

```
plan = personal_trial
status = trial
```

---

# Email verification

## Policy

Email verification should occur but **not block onboarding**.

Flow:

1. user signs up
2. verification email sent
3. user allowed to proceed
4. sensitive actions require verification later

Example message:

```
Please verify your email to enable messaging and integrations.
```

---

# Workspace creation step

Immediately after signup.

Screen:

```
Welcome to Roomflow
Let's set up your workspace
```

Fields:

```
Workspace name
Workspace type
```

---

### Workspace type options

```
Personal
Team / Organization
```

Descriptions:

Personal:

```
For solo operators or landlords managing their own properties.
```

Org:

```
For teams managing shared housing or multiple operators.
```

---

### Default behavior

If signup came from:

```
/signup?plan=personal
```

Preselect:

```
Personal
```

---

# Workspace naming

Default:

```
<First Name>'s Workspace
```

User can edit.

Examples:

```
Earl Cameron
Earl Rentals
Downtown Shared Housing
```

---

# DOs for workspace naming

DO:

* auto-generate default
* allow editing
* allow rename later

DON'T:

* force unique global name
* require legal company name

Workspace names are internal.

---

# Navigation behavior

After workspace creation:

Route to onboarding.

URL:

```
/onboarding/start
```

Sidebar disabled until onboarding step 2.

Top header visible.

---

# UI states

### Loading state

Button:

```
Creating workspace...
```

Spinner visible.

---

### Success state

Redirect:

```
/onboarding/property
```

---

### Error state

Examples:

```
Unable to create workspace
Please try again
```

---

# Invite link behavior

If signup occurs via invite link.

Example:

```
/signup?invite=xyz
```

Flow changes.

Steps:

1. user signs up
2. workspace NOT created
3. user joins existing workspace
4. membership role applied
5. route to workspace

---

### Invite acceptance UI

Page shows:

```
You've been invited to join:

ACME Shared Housing
```

Button:

```
Accept invitation
```

---

# Attribution capture

During signup, store:

```
utm_source
utm_campaign
utm_medium
landing_page
referrer
tool_source
```

Store on:

```
user
workspace
```

---

# Abuse prevention

Signup must include protections.

### Required protections

* rate limit signup attempts
* captcha after threshold
* block disposable email domains (optional)
* IP throttling
* anomaly logging

---

# Session creation

After signup:

Create session token.

Session cookie:

```
httpOnly
secure
sameSite=lax
```

Session duration:

```
7 days
```

---

# Audit logging

Log events:

```
user_created
workspace_created
membership_created
session_created
email_verification_sent
```

---

# Accessibility requirements

Signup page must support:

* keyboard navigation
* form labels
* screen reader labels
* visible focus state
* clear error messaging

---

# Mobile behavior

Mobile signup must support:

* large input fields
* autofill
* password manager
* Google login
* simple form layout

Avoid:

* multi-column layout
* tiny buttons

---

# Copywriting tone

Signup should feel:

* simple
* calm
* professional

Avoid:

* hype language
* aggressive growth marketing copy

Good examples:

```
Create your Roomflow account
```

```
Start organizing your room-rental inquiries
```

---

# Error scenarios

### Email already exists

Message:

```
This email already has an account.
Log in instead.
```

Link to login.

---

### Weak password

Message:

```
Please choose a stronger password.
```

---

### OAuth conflict

If Google account already linked:

```
Use Google to log in
```

---

# Security notes

Critical rules:

* passwords hashed with modern algorithm
* never log passwords
* never send passwords in email
* rotate auth tokens periodically
* verify OAuth email matches returned identity

---

# Analytics events

Track:

```
signup_started
signup_completed
signup_method
workspace_created
invite_accepted
```

---

# Completion criteria

Workflow is complete when:

User has:

```
User record
Workspace record
Membership
Active session
```

User is routed to:

```
Onboarding step 1
```

---

# UX success metric

Good signup experience should achieve:

```
Completion rate > 60%
Time to completion < 60 seconds
Dropoff < 25%
```

---

# Final summary

Workflow 1 must achieve:

* fast signup
* minimal friction
* correct workspace initialization
* secure authentication
* accurate attribution
* smooth onboarding transition

This workflow determines **conversion, retention, and architecture integrity**, so it must be designed carefully.

---

If you want, I can next produce **Workflow 2 in the same level of detail**, which is the **Create First Property workflow** — one of the most important flows in the entire product.
