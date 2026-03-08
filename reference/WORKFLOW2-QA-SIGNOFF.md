# Workflow 2 QA Signoff

Use this template for every Workflow 2 validation pass.

## Current local run

- Environment: Local development on Windows
- App URL: http://127.0.0.1:3001
- Database seed state: Run `npm run db:push` before QA and use `npm run db:seed:test-user` only when a seeded login is needed
- Git commit or working tree note: Local uncommitted changes allowed; capture the exact state you tested
- Operator running QA: GitHub Copilot can prepare the local session, but human validation is still required for visual, keyboard, copy, and assistive-technology checks
- Date: 2026-03-08

## Human pass focus for this run

- Desktop: `/onboarding/property`, `/app`, `/app/properties`
- Submit paths: required-fields-only success, missing-name, missing-property-type, missing-location, invalid rentable-room count
- Human-only checks still required: property-type clarity, focus visibility, keyboard order, mobile tap comfort, copy readability, and assistive-technology comprehension

## Run metadata

- Environment:
- App URL:
- Database seed state:
- Git commit or working tree note:
- Operator running QA:
- Date:

## Scenario

- Route tested:
- User fixture:
- Workspace fixture:
- Property fixture:
- Device or viewport:
- Automated in Playwright: Yes or No

## Expected result

-

## Actual result

-

## Data checks

- Property record:
- Property settings record:
- Audit events:
- Suggested house-rules artifact:
- Suggested intake artifact:
- Workspace onboarding state:

## Outcome

- Status: Pass or Fail
- Bug links:
- Follow-up notes: