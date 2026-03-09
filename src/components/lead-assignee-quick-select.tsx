"use client";

import { getLeadsPageCopy, type LeadsPageLocale } from "@/lib/leads-page-i18n";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useFormStatus } from "react-dom";

type AssignmentOption = {
  label: string;
  summary: string;
  value: string;
};

export function LeadAssigneeQuickSelect(props: {
  action: (formData: FormData) => void | Promise<void>;
  assignedMembershipId: string | null;
  assignmentOptions: AssignmentOption[];
  className?: string;
  currentAssigneeLabel?: string;
  disabled?: boolean;
  locale: LeadsPageLocale;
  redirectTo: string;
  variant?: "card" | "table";
}) {
  const copy = getLeadsPageCopy(props.locale);
  const formReference = useRef<HTMLFormElement | null>(null);
  const [selectedValue, setSelectedValue] = useState(
    props.assignedMembershipId ?? "unassigned",
  );

  useEffect(() => {
    setSelectedValue(props.assignedMembershipId ?? "unassigned");
  }, [props.assignedMembershipId]);

  const selectClassName =
    props.variant === "card"
      ? "h-11 rounded-2xl px-4 text-sm"
      : "h-10 rounded-xl px-3 text-xs";

  return (
    <form
      ref={formReference}
      action={props.action}
      className={props.className ?? "space-y-1.5"}
    >
      <input name="redirectTo" type="hidden" value={props.redirectTo} />
      <LeadAssigneeQuickSelectField
        assignedMembershipId={props.assignedMembershipId}
        assignmentOptions={props.assignmentOptions}
        currentAssigneeLabel={props.currentAssigneeLabel}
        disabled={props.disabled}
        formReference={formReference}
        locale={props.locale}
        selectClassName={selectClassName}
        selectedValue={selectedValue}
        setSelectedValue={setSelectedValue}
        updatingLabel={copy.quickAssign.updating}
      />
    </form>
  );
}

function LeadAssigneeQuickSelectField(props: {
  assignedMembershipId: string | null;
  assignmentOptions: AssignmentOption[];
  currentAssigneeLabel?: string;
  disabled?: boolean;
  formReference: RefObject<HTMLFormElement | null>;
  locale: LeadsPageLocale;
  selectClassName: string;
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  updatingLabel: string;
}) {
  const { pending } = useFormStatus();
  const copy = getLeadsPageCopy(props.locale);

  return (
    <>
      <select
        aria-label={copy.quickAssign.ariaLabel(props.currentAssigneeLabel)}
        className={`w-full border border-[rgba(184,88,51,0.18)] bg-[rgba(255,252,248,0.98)] text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_6px_16px_rgba(62,43,28,0.05)] outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-[rgba(184,88,51,0.3)] focus:bg-white focus:ring-4 focus:ring-[rgba(184,88,51,0.08)] disabled:cursor-not-allowed disabled:border-[rgba(160,141,121,0.16)] disabled:bg-[rgb(233,225,216)] disabled:text-[rgba(112,100,88,0.72)] ${props.selectClassName}`}
        disabled={props.disabled || pending}
        name="assignedMembershipId"
        onChange={(event) => {
          const nextValue = event.currentTarget.value;

          props.setSelectedValue(nextValue);

          if (nextValue !== (props.assignedMembershipId ?? "unassigned")) {
            props.formReference.current?.requestSubmit();
          }
        }}
        value={props.selectedValue}
      >
        {props.assignmentOptions.map((assignmentOption) => (
          <option key={assignmentOption.value} value={assignmentOption.value}>
            {assignmentOption.label}
          </option>
        ))}
      </select>
      <LeadAssigneeQuickSelectStatus updatingLabel={props.updatingLabel} />
    </>
  );
}

function LeadAssigneeQuickSelectStatus(props: { updatingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <div className="min-h-[1rem] text-[10px] font-medium uppercase tracking-[0.12em] text-[rgba(113,48,24,0.74)]">
      {pending ? props.updatingLabel : null}
    </div>
  );
}