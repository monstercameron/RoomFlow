export const supportedLeadsPageLocales = ["en", "es"] as const;

export type LeadsPageLocale = (typeof supportedLeadsPageLocales)[number];

const intlLocaleByLeadsPageLocale: Record<LeadsPageLocale, string> = {
  en: "en-US",
  es: "es-ES",
};

const leadsPageCopyByLocale = {
  en: {
    actions: {
      addFirstLead: "Add first lead",
      addLead: "Add lead",
      apply: "Apply",
      archive: "Archive",
      importLeads: "Import leads",
      openInbox: "Open inbox",
      openInboxInstead: "Open inbox instead",
      openLead: "Open lead",
      reset: "Reset",
      showArchived: "Show archived",
      unarchive: "Unarchive",
    },
    common: {
      manual: "Manual",
      noContactMethodSaved: "No contact method saved",
      noRecentActivity: "No recent activity",
      notRecorded: "Not recorded",
      notSet: "Not set",
      sharedInboxOwnershipRemainsOpen: "Shared inbox ownership remains open",
      unassigned: "Unassigned",
      yesterday: "Yesterday",
    },
    emptyStates: {
      noActiveMatched:
        "No active leads matched the current view. Archived leads are hidden until you turn on Show archived.",
      noLeadsDescription:
        "Add a manual lead to start qualification work, then use the inbox and lead detail views to request missing info, evaluate fit, and move the record forward.",
      noLeadsTitle: "No leads yet.",
      noSearchMatched: "No leads matched the current search or filter state.",
    },
    filters: {
      all: {
        description: "Everything in scope",
        label: "All leads",
      },
      archived: {
        description: "Archived records hidden from the active queue",
        label: "Archived",
      },
      awaitingResponse: {
        description: "New, waiting, or incomplete records",
        label: "Awaiting response",
      },
      overdue: {
        description: "Outside the active SLA window",
        label: "Overdue",
      },
      qualified: {
        description: "Fit result already passed",
        label: "Qualified",
      },
      review: {
        description: "Needs human judgment or review",
        label: "Review queue",
      },
      unassigned: {
        description: "No teammate assigned yet",
        label: "Unassigned",
      },
    },
    fitLabels: {
      CAUTION: "Caution",
      MISMATCH: "Mismatch",
      PASS: "Pass",
    },
    form: {
      allAssignments: "All assignees",
      allFits: "All fits",
      allProperties: "All properties",
      allSources: "All sources",
      allStatuses: "All statuses",
      assignment: "Assignment",
      filter: "Filter",
      fit: "Fit",
      property: "Property",
      rows: "Rows",
      rowsPerPage: (count: number) => `${count} per page`,
      search: "Search",
      searchPlaceholder: "Search by lead, source, phone, email, or property",
      source: "Source",
      status: "Status",
      sort: "Sort",
    },
    header: {
      description:
        "Review active demand, pull the next lead that needs action, and move into detail without losing queue context.",
      eyebrow: "Leads",
      title: "Qualification queue",
    },
    indicators: {
      askMissingQuestions: "Ask missing questions",
      awaitingResponse: "Awaiting response",
      duplicatePossible: "Duplicate possible",
      missingInfo: (count: number) =>
        count === 1 ? "1 answer missing" : `${count} answers missing`,
      missingInfoRequested: "Missing-info request sent",
      reviewLead: "Review lead",
      reviewNeeded: "Review needed",
      screeningPending: "Screening pending",
      stale: "Stale",
    },
    mobile: {
      assignee: "Assignee",
      budget: "Budget",
      lastActivity: "Last activity",
      moveIn: "Move-in",
      nextAction: "Next action",
    },
    pagination: {
      go: "Go",
      goTo: "Go to",
      loadingNextPage: "Loading next page of leads...",
      matchingLeads: (count: number) => `${count} matching leads`,
      next: "Next",
      pageOf: (page: number, pageCount: number) => `Page ${page} of ${pageCount}`,
      pageOption: (page: number) => `Page ${page}`,
      previous: "Previous",
      quickJump: "Quick jump",
    },
    quickAssign: {
      ariaLabel: (leadName?: string) => `Assign ${leadName ?? "lead"}`,
      updating: "Updating assignee...",
    },
    roles: {
      ADMIN: "Admin",
      MANAGER: "Manager",
      OWNER: "Owner",
      VIEWER: "Viewer",
    },
    sla: {
      response: "Response SLA",
      review: "Review SLA",
    },
    sorts: {
      assigneeAsc: "Assignee (A-Z)",
      assigneeDesc: "Assignee (Z-A)",
      budgetHigh: "Budget high to low",
      budgetLow: "Budget low to high",
      lastActivityAsc: "Last activity (oldest first)",
      lastActivityDesc: "Last activity (newest first)",
      moveInAsc: "Move-in date (soonest first)",
      moveInDesc: "Move-in date (latest first)",
      nameAsc: "Name (A-Z)",
      nameDesc: "Name (Z-A)",
      propertyAsc: "Property (A-Z)",
      propertyDesc: "Property (Z-A)",
    },
    statusLabels: {
      APPLICATION_SENT: "Application Sent",
      ARCHIVED: "Archived",
      AWAITING_RESPONSE: "Awaiting Response",
      CAUTION: "Caution",
      CLOSED: "Closed",
      DECLINED: "Declined",
      INCOMPLETE: "Incomplete",
      NEW: "New",
      QUALIFIED: "Qualified",
      TOUR_SCHEDULED: "Tour Scheduled",
      UNDER_REVIEW: "Under Review",
    },
    summaryCards: {
      awaitingResponse: {
        helper: (overdueCount: number) => `${overdueCount} already outside SLA`,
        label: "Awaiting response",
      },
      qualified: {
        helper: "Records that already fit this portfolio",
        label: "Qualified",
      },
      review: {
        helper: "Manual judgment and caution cases",
        label: "Review queue",
      },
      total: {
        helper: (unassignedCount: number) => `${unassignedCount} still need an assignee`,
        label: "Leads in scope",
      },
    },
    table: {
      actions: "Actions",
      assignee: "Assignee",
      fit: "Fit",
      lastActivity: "Last activity",
      lead: "Lead",
      nextAction: "Next action",
      property: "Property",
      sla: "SLA",
      status: "Status",
      timingBudget: "Timing + budget",
    },
  },
  es: {
    actions: {
      addFirstLead: "Agregar primer lead",
      addLead: "Agregar lead",
      apply: "Aplicar",
      archive: "Archivar",
      importLeads: "Importar leads",
      openInbox: "Abrir bandeja",
      openInboxInstead: "Abrir bandeja en su lugar",
      openLead: "Abrir lead",
      reset: "Restablecer",
      showArchived: "Mostrar archivados",
      unarchive: "Desarchivar",
    },
    common: {
      manual: "Manual",
      noContactMethodSaved: "No hay un método de contacto guardado",
      noRecentActivity: "No hay actividad reciente",
      notRecorded: "Sin registro",
      notSet: "Sin definir",
      sharedInboxOwnershipRemainsOpen: "La propiedad compartida de la bandeja sigue abierta",
      unassigned: "Sin asignar",
      yesterday: "Ayer",
    },
    emptyStates: {
      noActiveMatched:
        "Ningún lead activo coincide con la vista actual. Los archivados permanecen ocultos hasta que actives Mostrar archivados.",
      noLeadsDescription:
        "Agrega un lead manual para comenzar el proceso de calificación y luego usa la bandeja y la vista de detalle para solicitar información faltante, evaluar compatibilidad y avanzar el registro.",
      noLeadsTitle: "Todavía no hay leads.",
      noSearchMatched: "Ningún lead coincide con la búsqueda o el filtro actual.",
    },
    filters: {
      all: {
        description: "Todo dentro del alcance",
        label: "Todos los leads",
      },
      archived: {
        description: "Registros archivados ocultos de la cola activa",
        label: "Archivados",
      },
      awaitingResponse: {
        description: "Registros nuevos, en espera o incompletos",
        label: "Esperando respuesta",
      },
      overdue: {
        description: "Fuera de la ventana activa del SLA",
        label: "Vencidos",
      },
      qualified: {
        description: "El resultado de compatibilidad ya aprobó",
        label: "Calificados",
      },
      review: {
        description: "Necesita revisión o juicio humano",
        label: "Cola de revisión",
      },
      unassigned: {
        description: "Todavía no hay un compañero asignado",
        label: "Sin asignar",
      },
    },
    fitLabels: {
      CAUTION: "Precaución",
      MISMATCH: "No coincide",
      PASS: "Compatible",
    },
    form: {
      allAssignments: "Todos los responsables",
      allFits: "Todas las compatibilidades",
      allProperties: "Todas las propiedades",
      allSources: "Todas las fuentes",
      allStatuses: "Todos los estados",
      assignment: "Responsable",
      filter: "Filtro",
      fit: "Compatibilidad",
      property: "Propiedad",
      rows: "Filas",
      rowsPerPage: (count: number) => `${count} por página`,
      search: "Buscar",
      searchPlaceholder: "Buscar por lead, fuente, teléfono, correo o propiedad",
      source: "Fuente",
      status: "Estado",
      sort: "Ordenar",
    },
    header: {
      description:
        "Revisa la demanda activa, toma el siguiente lead que requiere acción y entra al detalle sin perder el contexto de la cola.",
      eyebrow: "Leads",
      title: "Cola de calificación",
    },
    indicators: {
      askMissingQuestions: "Solicitar datos faltantes",
      awaitingResponse: "Esperando respuesta",
      duplicatePossible: "Posible duplicado",
      missingInfo: (count: number) =>
        count === 1 ? "Falta 1 respuesta" : `Faltan ${count} respuestas`,
      missingInfoRequested: "Solicitud de datos ya enviada",
      reviewLead: "Revisar lead",
      reviewNeeded: "Revisión necesaria",
      screeningPending: "Screening pendiente",
      stale: "Vencido",
    },
    mobile: {
      assignee: "Asignado",
      budget: "Presupuesto",
      lastActivity: "Última actividad",
      moveIn: "Mudanza",
      nextAction: "Siguiente acción",
    },
    pagination: {
      go: "Ir",
      goTo: "Ir a",
      loadingNextPage: "Cargando la siguiente página de leads...",
      matchingLeads: (count: number) => `${count} leads coincidentes`,
      next: "Siguiente",
      pageOf: (page: number, pageCount: number) => `Página ${page} de ${pageCount}`,
      pageOption: (page: number) => `Página ${page}`,
      previous: "Anterior",
      quickJump: "Salto rápido",
    },
    quickAssign: {
      ariaLabel: (leadName?: string) => `Asignar ${leadName ?? "lead"}`,
      updating: "Actualizando asignación...",
    },
    roles: {
      ADMIN: "Administrador",
      MANAGER: "Gerente",
      OWNER: "Propietario",
      VIEWER: "Observador",
    },
    sla: {
      response: "SLA de respuesta",
      review: "SLA de revisión",
    },
    sorts: {
      assigneeAsc: "Asignado (A-Z)",
      assigneeDesc: "Asignado (Z-A)",
      budgetHigh: "Presupuesto de mayor a menor",
      budgetLow: "Presupuesto de menor a mayor",
      lastActivityAsc: "Última actividad (más antigua primero)",
      lastActivityDesc: "Última actividad (más reciente primero)",
      moveInAsc: "Fecha de mudanza (más próxima primero)",
      moveInDesc: "Fecha de mudanza (más lejana primero)",
      nameAsc: "Nombre (A-Z)",
      nameDesc: "Nombre (Z-A)",
      propertyAsc: "Propiedad (A-Z)",
      propertyDesc: "Propiedad (Z-A)",
    },
    statusLabels: {
      APPLICATION_SENT: "Solicitud enviada",
      ARCHIVED: "Archivado",
      AWAITING_RESPONSE: "Esperando respuesta",
      CAUTION: "Precaución",
      CLOSED: "Cerrado",
      DECLINED: "Rechazado",
      INCOMPLETE: "Incompleto",
      NEW: "Nuevo",
      QUALIFIED: "Calificado",
      TOUR_SCHEDULED: "Visita programada",
      UNDER_REVIEW: "En revisión",
    },
    summaryCards: {
      awaitingResponse: {
        helper: (overdueCount: number) => `${overdueCount} ya están fuera del SLA`,
        label: "Esperando respuesta",
      },
      qualified: {
        helper: "Registros que ya encajan con este portafolio",
        label: "Calificados",
      },
      review: {
        helper: "Casos con precaución o revisión manual",
        label: "Cola de revisión",
      },
      total: {
        helper: (unassignedCount: number) => `${unassignedCount} todavía necesitan asignación`,
        label: "Leads en alcance",
      },
    },
    table: {
      actions: "Acciones",
      assignee: "Asignado",
      fit: "Compatibilidad",
      lastActivity: "Última actividad",
      lead: "Lead",
      nextAction: "Siguiente acción",
      property: "Propiedad",
      sla: "SLA",
      status: "Estado",
      timingBudget: "Tiempo + presupuesto",
    },
  },
} satisfies Record<
  LeadsPageLocale,
  {
    actions: Record<string, string>;
    common: Record<string, string>;
    emptyStates: Record<string, string>;
    filters: Record<string, { description: string; label: string }>;
    fitLabels: Record<string, string>;
    form: {
      filter: string;
      rows: string;
      rowsPerPage: (count: number) => string;
      search: string;
      searchPlaceholder: string;
      sort: string;
    };
    header: Record<string, string>;
    indicators: {
      askMissingQuestions: string;
      awaitingResponse: string;
      duplicatePossible: string;
      missingInfo: (count: number) => string;
      missingInfoRequested: string;
      reviewLead: string;
      reviewNeeded: string;
      screeningPending: string;
      stale: string;
    };
    mobile: Record<string, string>;
    pagination: {
      go: string;
      goTo: string;
      loadingNextPage: string;
      matchingLeads: (count: number) => string;
      next: string;
      pageOf: (page: number, pageCount: number) => string;
      pageOption: (page: number) => string;
      previous: string;
      quickJump: string;
    };
    quickAssign: {
      ariaLabel: (leadName?: string) => string;
      updating: string;
    };
    roles: Record<string, string>;
    sla: Record<string, string>;
    sorts: Record<string, string>;
    statusLabels: Record<string, string>;
    summaryCards: {
      awaitingResponse: { helper: (overdueCount: number) => string; label: string };
      qualified: { helper: string; label: string };
      review: { helper: string; label: string };
      total: { helper: (unassignedCount: number) => string; label: string };
    };
    table: Record<string, string>;
  }
>;

export type LeadsPageCopy = (typeof leadsPageCopyByLocale)[LeadsPageLocale];

export function resolveLeadsPageLocale(
  acceptLanguageHeader: string | null | undefined,
): LeadsPageLocale {
  if (!acceptLanguageHeader) {
    return "en";
  }

  const requestedLocales = acceptLanguageHeader
    .split(",")
    .map((entry) => entry.split(";")[0]?.trim().toLowerCase())
    .filter((entry): entry is string => Boolean(entry));

  for (const requestedLocale of requestedLocales) {
    if (requestedLocale.startsWith("es")) {
      return "es";
    }

    if (requestedLocale.startsWith("en")) {
      return "en";
    }
  }

  return "en";
}

export function getIntlLocaleForLeadsPageLocale(locale: LeadsPageLocale) {
  return intlLocaleByLeadsPageLocale[locale];
}

export function getLeadsPageCopy(locale: LeadsPageLocale): LeadsPageCopy {
  return leadsPageCopyByLocale[locale];
}

export function getLocalizedLeadFitLabel(value: string, locale: LeadsPageLocale) {
  const copy = getLeadsPageCopy(locale);
  const fitLabels = copy.fitLabels as Record<string, string>;

  return fitLabels[value] ?? value;
}

export function getLocalizedLeadStatusLabel(
  value: string,
  locale: LeadsPageLocale,
) {
  const copy = getLeadsPageCopy(locale);
  const statusLabels = copy.statusLabels as Record<string, string>;

  return statusLabels[value] ?? value;
}

export function getLocalizedMembershipRoleLabel(
  value: string,
  locale: LeadsPageLocale,
) {
  const copy = getLeadsPageCopy(locale);
  const roleLabels = copy.roles as Record<string, string>;

  return roleLabels[value] ?? value;
}

export function getLocalizedLeadSlaLabel(
  queue: string,
  locale: LeadsPageLocale,
) {
  const copy = getLeadsPageCopy(locale);

  return queue === "review" ? copy.sla.review : copy.sla.response;
}