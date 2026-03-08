# Workflow 3 QA Signoff

Use this template for every Workflow 3 validation pass.

## Current local run

- Environment: Local development on Windows
- App URL: http://127.0.0.1:3001
- Database seed state: Run `npm run db:push` before QA; create a fresh onboarding fixture or seed login that starts after Workflow 2
- Git commit or working tree note: Capture the exact branch or local diff you tested
- Operator running QA: GitHub Copilot can prepare the flow and automation, but human validation is still required for visual quality, keyboard behavior, copy clarity, and assistive-technology checks
- Date: 2026-03-08

## Human pass focus for this run

- Desktop: `/onboarding/house-rules`, `/onboarding/questions`, `/app/properties/[propertyId]/rules`
- Submit paths: empty-rules validation, suggested-rule edits, suggested-rule removal, custom-rule create, incomplete custom rule validation, successful save to questions, starter-question apply flow
- Human-only checks still required: copy feels specific to shared housing, severity language is understandable, summary counts stay trustworthy, focus order is clear, mobile tap targets are comfortable, and screen-reader output is understandable

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
- Rule mix:
- Severity mix:
- Device or viewport:
- Automated in Playwright: Yes or No

## Expected result

-

## Actual result

-

## Data checks

- Property rules:
- Normalized selected values:
- Severity metadata:
- `house_rules_completed` audit event:
- Starter intake artifact:
- Active question set:
- Workspace onboarding state:

## Outcome

- Status: Pass or Fail
- Bug links:
- Follow-up notes: