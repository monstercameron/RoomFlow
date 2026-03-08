export type NavItem = {
  href: string;
  label: string;
  description: string;
};

export const appNav: NavItem[] = [
  {
    href: "/app",
    label: "Dashboard",
    description: "Operational snapshot",
  },
  {
    href: "/app/leads",
    label: "Leads",
    description: "Qualification queue",
  },
  {
    href: "/app/inbox",
    label: "Inbox",
    description: "Message threads and triage",
  },
  {
    href: "/app/properties",
    label: "Properties",
    description: "Rules and setup",
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    description: "Tours and handoff queue",
  },
  {
    href: "/app/templates",
    label: "Templates",
    description: "Reusable messages",
  },
  {
    href: "/app/workflows",
    label: "Workflows",
    description: "Automation builder",
  },
  {
    href: "/app/settings",
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
    href: "/onboarding/channels",
    label: "Channels",
    description: "Choose where leads arrive",
  },
];
