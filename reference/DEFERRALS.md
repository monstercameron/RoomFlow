## Deferred v1 Scope

We are keeping the initial release of Roomflow focused on a single-operator workflow that covers lead intake, qualification, and outbound follow-ups. The following capabilities are intentionally deferred until the event/audit model matures and customer requirements for those areas become clearer:

1. **`room` model:** Instead of modeling a separate `room` entity we treat `property` records as the primary unit for housing inventory; room-level tracking adds complexity (availability, micro-pricing, occupancy) that is not required for the MVP and would duplicate the property/lead mapping already in place.
2. **Team management:** The stack currently supports only workspace memberships plus the single founding operator. Any multi-user/team admin flows (invites, roles beyond `OWNER`) are postponed until we have a stable single-operator experience and a clear billing model.
3. **Full analytics:** Dashboard summaries and the audit+event streams capture the minimum metrics we need today. More advanced analytics (including `/app/analytics` and related reporting) will arrive after the event/timeline schema proves stable.
4. **Billing:** There is no active plan or pricing logic in the repo. The `/app/settings/billing` route remains deferred because pricing rules and payment integrations are still in discovery.

We can revisit each of these once the core workflow is live and we understand actual user demand.
