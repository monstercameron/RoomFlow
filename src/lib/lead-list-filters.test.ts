import assert from "node:assert/strict";
import test from "node:test";
import { LeadStatus, QualificationFit } from "@/generated/prisma/client";
import {
  buildLeadListFilterClauses,
  buildLeadListWhereClause,
  buildLeadListWorkflowFilterClauses,
} from "@/lib/lead-list-filters";

test("buildLeadListWorkflowFilterClauses composes property, status, fit, source, and assignment filters", () => {
  assert.deepEqual(
    buildLeadListWorkflowFilterClauses({
      assignment: "membership-1",
      fit: QualificationFit.CAUTION,
      property: "property-1",
      source: "source-1",
      status: LeadStatus.UNDER_REVIEW,
    }),
    [
      { propertyId: "property-1" },
      { status: LeadStatus.UNDER_REVIEW },
      { fitResult: QualificationFit.CAUTION },
      { leadSourceId: "source-1" },
      { assignedMembershipId: "membership-1" },
    ],
  );

  assert.deepEqual(
    buildLeadListWorkflowFilterClauses({
      assignment: "unassigned",
      property: "unassigned",
      source: "manual",
    }),
    [
      { propertyId: null },
      { leadSourceId: null },
      { assignedMembershipId: null },
    ],
  );
});

test("buildLeadListFilterClauses maps review and overdue buckets deterministically", () => {
  const filterClauses = buildLeadListFilterClauses(new Set(["lead-1", "lead-2"]));

  assert.deepEqual(filterClauses.review, {
    OR: [
      { fitResult: QualificationFit.CAUTION },
      { fitResult: QualificationFit.MISMATCH },
      { status: LeadStatus.UNDER_REVIEW },
    ],
  });
  assert.deepEqual(filterClauses.overdue, {
    id: {
      in: ["lead-1", "lead-2"],
    },
  });
});

test("buildLeadListWhereClause keeps archived visibility, quick buckets, search, and workflow filters in one AND tree", () => {
  assert.deepEqual(
    buildLeadListWhereClause({
      activeFilter: "review",
      activeQuery: "avery",
      activeWorkflowFilters: {
        assignment: "membership-1",
        fit: QualificationFit.PASS,
        property: "property-1",
        source: "manual",
        status: LeadStatus.QUALIFIED,
      },
      baseWhere: {
        workspaceId: "workspace-1",
      },
      overdueLeadIds: new Set<string>(),
      showArchived: false,
    }),
    {
      workspaceId: "workspace-1",
      AND: [
        {
          status: {
            not: LeadStatus.ARCHIVED,
          },
        },
        {
          OR: [
            { fitResult: QualificationFit.CAUTION },
            { fitResult: QualificationFit.MISMATCH },
            { status: LeadStatus.UNDER_REVIEW },
          ],
        },
        {
          OR: [
            {
              fullName: {
                contains: "avery",
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: "avery",
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: "avery",
                mode: "insensitive",
              },
            },
          ],
        },
        { propertyId: "property-1" },
        { status: LeadStatus.QUALIFIED },
        { fitResult: QualificationFit.PASS },
        { leadSourceId: null },
        { assignedMembershipId: "membership-1" },
      ],
    },
  );
});