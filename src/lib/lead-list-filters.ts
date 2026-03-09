import {
  LeadStatus,
  QualificationFit,
  type Prisma,
} from "@/generated/prisma/client";

export type LeadListFilterValue =
  | "all"
  | "awaiting-response"
  | "archived"
  | "review"
  | "qualified"
  | "unassigned"
  | "overdue";

export type LeadListWorkflowFilters = {
  assignment?: string;
  fit?: QualificationFit;
  property?: string;
  source?: string;
  status?: LeadStatus;
};

export function buildLeadListWorkflowFilterClauses(
  filters: LeadListWorkflowFilters,
): Prisma.LeadWhereInput[] {
  const clauses: Prisma.LeadWhereInput[] = [];

  if (filters.property) {
    clauses.push(
      filters.property === "unassigned"
        ? {
            propertyId: null,
          }
        : {
            propertyId: filters.property,
          },
    );
  }

  if (filters.status) {
    clauses.push({
      status: filters.status,
    });
  }

  if (filters.fit) {
    clauses.push({
      fitResult: filters.fit,
    });
  }

  if (filters.source) {
    clauses.push(
      filters.source === "manual"
        ? {
            leadSourceId: null,
          }
        : {
            leadSourceId: filters.source,
          },
    );
  }

  if (filters.assignment) {
    clauses.push(
      filters.assignment === "unassigned"
        ? {
            assignedMembershipId: null,
          }
        : {
            assignedMembershipId: filters.assignment,
          },
    );
  }

  return clauses;
}

export function buildLeadListFilterClauses(overdueLeadIds: Set<string>) {
  return {
    all: null,
    "awaiting-response": {
      status: {
        in: [LeadStatus.NEW, LeadStatus.AWAITING_RESPONSE, LeadStatus.INCOMPLETE],
      },
    },
    archived: {
      status: LeadStatus.ARCHIVED,
    },
    overdue:
      overdueLeadIds.size > 0
        ? {
            id: {
              in: [...overdueLeadIds],
            },
          }
        : {
            id: {
              in: ["__no_matching_overdue_leads__"],
            },
          },
    qualified: {
      fitResult: QualificationFit.PASS,
    },
    review: {
      OR: [
        {
          fitResult: QualificationFit.CAUTION,
        },
        {
          fitResult: QualificationFit.MISMATCH,
        },
        {
          status: LeadStatus.UNDER_REVIEW,
        },
      ],
    },
    unassigned: {
      assignedMembershipId: null,
    },
  } satisfies Record<LeadListFilterValue, Prisma.LeadWhereInput | null>;
}

export function buildLeadListSearchClause(
  activeQuery: string,
): Prisma.LeadWhereInput | null {
  return activeQuery
    ? {
        OR: [
          {
            fullName: {
              contains: activeQuery,
              mode: "insensitive" as const,
            },
          },
          {
            email: {
              contains: activeQuery,
              mode: "insensitive" as const,
            },
          },
          {
            phone: {
              contains: activeQuery,
              mode: "insensitive" as const,
            },
          },
        ],
      }
    : null;
}

export function buildLeadListArchivedVisibilityClause(showArchived: boolean) {
  return showArchived
    ? null
    : {
        status: {
          not: LeadStatus.ARCHIVED,
        },
      } satisfies Prisma.LeadWhereInput;
}

export function buildLeadListWhereClause(params: {
  activeFilter: LeadListFilterValue;
  activeQuery: string;
  activeWorkflowFilters: LeadListWorkflowFilters;
  baseWhere: Prisma.LeadWhereInput;
  overdueLeadIds: Set<string>;
  showArchived: boolean;
}) {
  const filterClauses = buildLeadListFilterClauses(params.overdueLeadIds);
  const searchClause = buildLeadListSearchClause(params.activeQuery);
  const workflowFilterClauses = buildLeadListWorkflowFilterClauses(
    params.activeWorkflowFilters,
  );
  const archivedVisibilityClause = buildLeadListArchivedVisibilityClause(
    params.showArchived,
  );

  return {
    ...params.baseWhere,
    AND: [
      archivedVisibilityClause,
      filterClauses[params.activeFilter],
      searchClause,
      ...workflowFilterClauses,
    ].filter((clause): clause is Prisma.LeadWhereInput => clause !== null),
  } satisfies Prisma.LeadWhereInput;
}