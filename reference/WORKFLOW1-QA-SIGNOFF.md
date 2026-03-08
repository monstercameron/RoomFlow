# Workflow 1 QA Signoff

Use this template for every Workflow 1 validation pass.

## Current local run

- Environment: Local development on Windows
- App URL: http://127.0.0.1:3001
- Database seed state: `npm run db:push` and `npm run db:seed:test-user` completed on 2026-03-08
- Git commit or working tree note: `2ccfb20` plus local uncommitted changes
- Operator running QA: GitHub Copilot prepared the live session; human validation still required for visual, keyboard, autofill, and assistive-tech checks
- Date: 2026-03-08
- Seed login: `test@roomflow.local` / `Roomflow123!`
- Fresh invite route: `/invite/78d0cbce03b9e98e64b4edba67e0eb44cb99f3bbb4e3459e`

## Human pass focus for this run

- Desktop: `/signup`, `/signup?plan=personal`, `/signup?plan=org`, `/signup?source=ai-tool`, `/signup?utm_campaign=test`
- Invite: `/signup?invite=78d0cbce03b9e98e64b4edba67e0eb44cb99f3bbb4e3459e` and `/invite/78d0cbce03b9e98e64b4edba67e0eb44cb99f3bbb4e3459e`
- Auth recovery: `/magic-link?plan=org&source=ai-tool` and `/signup?error=unable_to_link_account&provider=google`
- Human-only checks still required: keyboard order, visible focus states, autofill or password-manager behavior, copy readability, tap target comfort, and assistive-technology comprehension

## Run metadata

- Environment:
- App URL:
- Database seed state:
- Git commit or working tree note:
- Operator running QA:
- Date:

## Scenario

- Auth method:
- Route tested:
- Query params:
- Invite token or fixture:
- Device or viewport:
- Automated in Playwright: Yes or No

## Expected result

-

## Actual result

-

## Data checks

- User record:
- Workspace record:
- Membership record:
- Session record:
- Attribution or campaign state:
- Audit or invite state:

## Outcome

- Status: Pass or Fail
- Bug links:
- Follow-up notes:

## Provider rule

Third-party auth providers should only be automated in Playwright when the environment has deterministic mocks or stable test credentials. Until then, Google and other social providers stay covered by focused unit tests plus manual signoff.