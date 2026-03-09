export type NavItem = {
  href: string;
  icon: string;
  label: string;
  description: string;
};

export const appNav: NavItem[] = [
  {
    href: "/app",
    icon: "dashboard",
    label: "Dashboard",
    description: "Operational snapshot",
  },
  {
    href: "/app/analytics",
    icon: "analytics",
    label: "Analytics",
    description: "Funnels and performance",
  },
  {
    href: "/app/leads",
    icon: "leads",
    label: "Leads",
    description: "Qualification queue",
  },
  {
    href: "/app/inbox",
    icon: "inbox",
    label: "Inbox",
    description: "Message threads and triage",
  },
  {
    href: "/app/properties",
    icon: "properties",
    label: "Properties",
    description: "Rules and setup",
  },
  {
    href: "/app/calendar",
    icon: "calendar",
    label: "Calendar",
    description: "Tours and handoff queue",
  },
  {
    href: "/app/tasks",
    icon: "tasks",
    label: "Tasks",
    description: "Assigned follow-up work",
  },
  {
    href: "/app/templates",
    icon: "templates",
    label: "Templates",
    description: "Reusable messages",
  },
  {
    href: "/app/workflows",
    icon: "workflows",
    label: "Workflows",
    description: "Automation builder",
  },
  {
    href: "/app/audit",
    icon: "audit",
    label: "Audit",
    description: "Sensitive actions and history",
  },
  {
    href: "/app/settings",
    icon: "settings",
    label: "Settings",
    description: "Account and integrations",
  },
];

export const onboardingSteps = [
  {
    href: "/onboarding/property",
    label: "Property",
    description: "Create the first shared home",
  },
  {
    href: "/onboarding/house-rules",
    label: "House Rules",
    description: "Define fit constraints",
  },
  {
    href: "/onboarding/questions",
    label: "Questions",
    description: "Review lead qualification prompts",
  },
  {
    href: "/onboarding/channels",
    label: "Channels",
    description: "Choose where leads arrive",
  },
];
